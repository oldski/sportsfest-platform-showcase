// Showcase note: the client kept its rule sheets and recruiting PDFs in WordPress. A small
// plugin exposes them over the WordPress REST API and this fetcher pulls them into the
// organizer dashboard, so documents are edited where they always were.

'use server';

export interface WordPressDocument {
  id: number;
  title: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  dateModified: string;
}

export interface WordPressApiResponse {
  success: boolean;
  documents: WordPressDocument[];
  error?: string;
}

/**
 * Fetches recruitment documents from WordPress REST API
 */
export async function getRecruitmentDocuments(): Promise<WordPressApiResponse> {
  try {
    const wordpressUrl = process.env.WORDPRESS_API_URL;

    if (!wordpressUrl) {
      console.error('WORDPRESS_API_URL environment variable is not set');
      return {
        success: false,
        documents: [],
        error: 'WordPress API URL not configured'
      };
    }

    // Construct the API endpoint URL
    const endpoint = `${wordpressUrl}/wp-json/wp/v2/media`;

    // Query parameters to filter for PDF documents
    const params = new URLSearchParams({
      media_type: 'application', // PDF files are under 'application' media type
      mime_type: 'application/pdf',
      per_page: '100', // Adjust as needed
      orderby: 'date',
      order: 'desc'
    });

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${endpoint}?${params}`, {
      method: 'GET',
      headers,
      // Cache for 5 minutes to avoid hitting WordPress too frequently
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      throw new Error(`WordPress API responded with status: ${response.status}`);
    }

    const mediaItems = await response.json();

    // Transform WordPress media response to our document format
    const documents: WordPressDocument[] = mediaItems
      .filter((item: any) => item.mime_type === 'application/pdf')
      .map((item: any) => ({
        id: item.id,
        title: item.title?.rendered || item.slug || 'Untitled Document',
        url: item.source_url || item.guid?.rendered,
        fileName: item.slug || `document-${item.id}.pdf`,
        fileSize: item.media_details?.filesize || 0,
        mimeType: item.mime_type,
        dateModified: item.modified || item.date
      }));

    console.log(`✅ Successfully fetched ${documents.length} recruitment documents from WordPress`);

    return {
      success: true,
      documents
    };

  } catch (error) {
    console.error('❌ Error fetching recruitment documents from WordPress:', error);

    return {
      success: false,
      documents: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Alternative function to fetch documents from a custom WordPress endpoint
 * Use this if you create a custom endpoint specifically for recruitment documents
 */
export async function getCustomRecruitmentDocuments(): Promise<WordPressApiResponse> {
  try {
    const wordpressUrl = process.env.WORDPRESS_API_URL;

    if (!wordpressUrl) {
      return {
        success: false,
        documents: [],
        error: 'WordPress API URL not configured'
      };
    }

    // Custom endpoint URL (you'll need to create this in WordPress)
    const endpoint = `${wordpressUrl}/wp-json/sportsfest/v1/recruitment-documents`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      throw new Error(`Custom WordPress API responded with status: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      documents: data.documents || []
    };

  } catch (error) {
    console.error('❌ Error fetching custom recruitment documents from WordPress:', error);

    return {
      success: false,
      documents: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}