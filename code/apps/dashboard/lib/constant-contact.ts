// Showcase note: a hand-written client for the Constant Contact v3 API. OAuth refresh tokens
// rotate on every use, so the client persists the newest one in a settings table and refreshes
// lazily; callers just ask for a contact to be added to a list.

/**
 * Constant Contact API Integration (OAuth2)
 *
 * This module handles adding contacts to Constant Contact marketing lists using OAuth2.
 * Contacts are added to different lists based on their role:
 * - Admins/Captains: Organization leaders who sign up
 * - Players: Team members who register through the team signup form
 *
 * OAuth2 Setup:
 * 1. Create an app at https://app.constantcontact.com/pages/dma/portal/
 * 2. Use Authorization Code Flow with Rotating Refresh Tokens
 * 3. Get your Client ID, Client Secret, and initial Refresh Token
 * 4. Run initialization script to save refresh token to database
 *
 * Token Rotation:
 * - Refresh tokens are automatically stored in the database
 * - When tokens rotate, the new token is automatically saved
 * - No manual intervention required for token rotation
 */

import { db, eq } from '@workspace/database/client';
import { settingsTable } from '@workspace/database/schema';

interface ConstantContactConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  tokenExpiry?: number;
  adminsListId: string; // List ID for organization admins/captains
  playersListId: string; // List ID for team players/interested athletes
}

interface ContactData {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  customFields?: Record<string, string>;
}

interface AddContactToListParams {
  contact: ContactData;
  listType: 'admins' | 'players';
  organizationName?: string;
  organizationType?: string;
  referralSource?: string;
}

class ConstantContactService {
  private config: ConstantContactConfig;
  private baseUrl = 'https://api.cc.email/v3';
  private authUrl = 'https://authz.constantcontact.com/oauth2/default/v1/token';
  private refreshTokenLoaded = false;

  constructor() {
    this.config = {
      clientId: process.env.CONSTANT_CONTACT_CLIENT_ID || '',
      clientSecret: process.env.CONSTANT_CONTACT_CLIENT_SECRET || '',
      refreshToken: process.env.CONSTANT_CONTACT_REFRESH_TOKEN || '', // Fallback to env for initial setup
      adminsListId: process.env.CONSTANT_CONTACT_ADMINS_LIST_ID || '',
      playersListId: process.env.CONSTANT_CONTACT_PLAYERS_LIST_ID || ''
    };
  }

  /**
   * Load refresh token from database
   * Falls back to environment variable if not found in database
   */
  private async loadRefreshToken(): Promise<string> {
    try {
      const result = await db
        .select({ value: settingsTable.value })
        .from(settingsTable)
        .where(eq(settingsTable.key, 'constant_contact_refresh_token'))
        .limit(1);

      if (result.length > 0 && result[0].value) {
        return result[0].value;
      }

      // Fallback to environment variable for initial setup
      return process.env.CONSTANT_CONTACT_REFRESH_TOKEN || '';
    } catch (error) {
      console.error('Error loading refresh token from database:', error);
      // Fallback to environment variable
      return process.env.CONSTANT_CONTACT_REFRESH_TOKEN || '';
    }
  }

  /**
   * Save refresh token to database
   */
  private async saveRefreshToken(token: string): Promise<void> {
    try {
      // Use INSERT ... ON CONFLICT to upsert the token
      await db
        .insert(settingsTable)
        .values({
          key: 'constant_contact_refresh_token',
          value: token,
          description: 'Constant Contact OAuth2 refresh token (automatically updated when rotated)',
          updatedAt: new Date(),
          createdAt: new Date()
        })
        .onConflictDoUpdate({
          target: settingsTable.key,
          set: {
            value: token,
            updatedAt: new Date()
          }
        });

      console.log('✅ Refresh token saved to database successfully');
    } catch (error) {
      console.error('❌ Error saving refresh token to database:', error);
      // Don't throw - we don't want to break the flow if database save fails
    }
  }

  /**
   * Check if Constant Contact is configured
   */
  public isConfigured(): boolean {
    return !!(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.refreshToken &&
      this.config.adminsListId &&
      this.config.playersListId
    );
  }

  /**
   * Get a valid access token (refreshes if needed)
   */
  private async getAccessToken(): Promise<string> {
    // If we have a valid access token, return it
    if (this.config.accessToken && this.config.tokenExpiry && Date.now() < this.config.tokenExpiry) {
      return this.config.accessToken;
    }

    // Load refresh token from database on first use
    if (!this.refreshTokenLoaded) {
      this.config.refreshToken = await this.loadRefreshToken();
      this.refreshTokenLoaded = true;
    }

    // Otherwise, refresh the token
    try {
      const authString = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

      const response = await fetch(this.authUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.config.refreshToken
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh token: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Store the new access token and expiry
      this.config.accessToken = data.access_token;
      this.config.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Expire 1 minute early for safety

      // If we got a new refresh token (rotating tokens), save it to database
      if (data.refresh_token && data.refresh_token !== this.config.refreshToken) {
        console.log('🔄 Refresh token rotated - automatically saving to database');
        // Update in memory for this session
        this.config.refreshToken = data.refresh_token;
        // Save to database (no manual intervention needed)
        await this.saveRefreshToken(data.refresh_token);
      }

      if (!this.config.accessToken) {
        throw new Error('Failed to obtain access token');
      }

      return this.config.accessToken;
    } catch (error) {
      console.error('Error refreshing Constant Contact access token:', error);
      throw error;
    }
  }

  /**
   * Add a contact to a Constant Contact list
   */
  public async addContactToList(params: AddContactToListParams): Promise<void> {
    // If not configured, skip silently (allows development without Constant Contact)
    if (!this.isConfigured()) {
      console.warn('Constant Contact is not configured. Skipping contact addition.');
      return;
    }

    const { contact, listType, organizationName, organizationType, referralSource } = params;

    // Determine which list to add to
    const listId = listType === 'admins'
      ? this.config.adminsListId
      : this.config.playersListId;

    try {
      // Get a valid access token
      const accessToken = await this.getAccessToken();

      // Prepare contact payload for Constant Contact API v3
      const payload = {
        email_address: {
          address: contact.email,
          permission_to_send: 'implicit' // or 'explicit' based on your compliance needs
        },
        first_name: contact.firstName || '',
        last_name: contact.lastName || '',
        company_name: organizationName || '', // Standard Company field in Constant Contact
        phone_numbers: contact.phone ? [{
          phone_number: contact.phone,
          kind: 'mobile'
        }] : [],
        list_memberships: [listId],
        create_source: 'Account' // Required by Constant Contact API - indicates source of contact creation
      };

      // Make API request to Constant Contact
      const response = await fetch(`${this.baseUrl}/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Constant Contact API error:', errorText);

        // Don't throw error - we don't want to block user signup/registration if CC fails
        // Just log it for debugging
        console.error(`Failed to add contact to Constant Contact: ${response.status} - ${errorText}`);
      } else {
        const result = await response.json();
        console.log('Successfully added contact to Constant Contact:', contact.email);
        return result;
      }
    } catch (error) {
      // Log error but don't throw - we don't want to break the user flow
      console.error('Error adding contact to Constant Contact:', error);
    }
  }

  /**
   * Build custom fields array for Constant Contact
   */
  private buildCustomFields(fields: Record<string, string | undefined>): Array<{ custom_field_id: string; value: string }> {
    const customFields: Array<{ custom_field_id: string; value: string }> = [];

    // Map our fields to Constant Contact custom field IDs
    // Note: You'll need to create these custom fields in Constant Contact first
    // and update these IDs with your actual custom field IDs
    // Leave empty strings to disable custom fields
    const fieldMapping: Record<string, string> = {
      organizationName: process.env.CONSTANT_CONTACT_CUSTOM_FIELD_ORG_NAME || '', // Optional: Add to .env if you create this field
      organizationType: process.env.CONSTANT_CONTACT_CUSTOM_FIELD_ORG_TYPE || '', // Optional: Add to .env if you create this field
      referralSource: process.env.CONSTANT_CONTACT_CUSTOM_FIELD_REFERRAL_SOURCE || '' // Optional: Add to .env if you create this field
    };

    Object.entries(fields).forEach(([key, value]) => {
      // Only add custom fields if we have valid IDs (not empty strings)
      if (value && fieldMapping[key] && fieldMapping[key].trim() !== '') {
        customFields.push({
          custom_field_id: fieldMapping[key],
          value: value
        });
      }
    });

    return customFields;
  }

  /**
   * Add an admin/captain to the admins list
   */
  public async addAdmin(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    organizationName?: string;
    organizationType?: string;
    referralSource?: string;
  }): Promise<void> {
    return this.addContactToList({
      contact: {
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        phone: params.phone
      },
      listType: 'admins',
      organizationName: params.organizationName,
      organizationType: params.organizationType,
      referralSource: params.referralSource
    });
  }

  /**
   * Add a player/interested athlete to the players list
   */
  public async addPlayer(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    organizationName?: string;
  }): Promise<void> {
    return this.addContactToList({
      contact: {
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        phone: params.phone
      },
      listType: 'players',
      organizationName: params.organizationName
    });
  }
}

// Export singleton instance
export const constantContactService = new ConstantContactService();