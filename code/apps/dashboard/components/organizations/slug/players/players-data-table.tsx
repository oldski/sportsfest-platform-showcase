// Showcase note: a product table composed from the design system DataTable. Adds a role
// filter (playing vs spectating), a role badge, row actions, and CSV, Excel and PDF exports.
// The dialogs and the export helpers it imports are omitted from the showcase; the
// participation helpers (countByParticipation, getParticipationLabel) are small lib functions.

'use client';

import * as React from 'react';
import NiceModal from '@ebay/nice-modal-react';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Table as ReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { DownloadIcon, EyeIcon, PencilIcon, UserXIcon } from 'lucide-react';
import { ParticipationType } from '@workspace/database/schema';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select';
import { countByParticipation, getParticipationLabel } from '~/lib/participation';
import { useRouter } from 'next/navigation';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableColumnOptionsHeader,
  DataTablePagination,
} from '@workspace/ui/components/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import type { PlayerWithDetails, GetPlayersResult } from '~/data/players/get-players';
import { formatPhoneNumber } from '~/lib/formatters';
import { Input } from "@workspace/ui/components/input";
import { generatePlayersReactPDF } from './generate-players-pdf';
import { ViewPlayerDialog } from './view-player-dialog';
import { EditPlayerDialog } from './edit-player-dialog';
import { DeletePlayerDialog } from './delete-player-dialog';

interface PlayersDataTableProps {
  data: GetPlayersResult;
  eventYears: Array<{ id: string; year: number; name: string }>;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}


// Helper function to get gender display text
function getGenderDisplay(gender: string) {
  switch (gender) {
    case 'male':
      return 'Male';
    case 'female':
      return 'Female';
    case 'non_binary':
      return 'Non-binary';
    case 'prefer_not_to_say':
      return 'Prefer not to say';
    default:
      return gender;
  }
}

const EVENT_TYPES: Record<string, string> = {
  beach_volleyball: 'Beach Volleyball',
  tug_of_war: 'Tug of War',
  corn_toss: 'Corn Toss',
  bote_beach_challenge: 'Surf & Turf Relay',
  beach_dodgeball: 'Beach Dodgeball',
};

function getStarRating(interestRating: number): string {
  const stars = 6 - interestRating;
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

function getPlayerEventRating(player: PlayerWithDetails, eventType: string, format: 'stars' | 'numeric' = 'stars'): string {
  const interest = player.eventInterests.find(i => i.eventType === eventType);
  if (!interest) return '';
  const value = 6 - interest.interestRating;
  if (format === 'numeric') return `${value} ${value === 1 ? 'star' : 'stars'}`;
  return getStarRating(interest.interestRating);
}

// Custom export functions for players data table
const exportPlayersToCSV = async (
  players: PlayerWithDetails[],
  filename: string
) => {
  const Papa = (await import('papaparse')).default;

  const eventTypeKeys = Object.keys(EVENT_TYPES);
  const headers = ['First Name', 'Last Name', 'Role', 'Email', 'Phone', 'Gender', 'Age', 'T-Shirt', ...eventTypeKeys.map(k => EVENT_TYPES[k]!), 'Registered'];

  const data = players.map((player) => {
    const row: Record<string, string> = {
      'First Name': player.firstName || '',
      'Last Name': player.lastName || '',
      'Role': getParticipationLabel(player.participationType),
      'Email': player.email || '',
      'Phone': player.phone || '',
      'Gender': getGenderDisplay(player.gender),
      'Age': player.dateOfBirth ? format(new Date(player.dateOfBirth), 'yyyy-MM-dd') : '',
      'T-Shirt': player.tshirtSize ? player.tshirtSize.toUpperCase() : '',
    };
    for (const eventType of eventTypeKeys) {
      row[EVENT_TYPES[eventType]!] = getPlayerEventRating(player, eventType, 'numeric');
    }
    row['Registered'] = player.createdAt ? format(new Date(player.createdAt), 'yyyy-MM-dd') : '';
    return row;
  });

  const csv = Papa.unparse({ fields: headers, data });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportPlayersToExcel = async (
  players: PlayerWithDetails[],
  filename: string
) => {
  const XLSX = await import('xlsx');

  const eventTypeKeys = Object.keys(EVENT_TYPES);
  const headers = ['First Name', 'Last Name', 'Role', 'Email', 'Phone', 'Gender', 'Age', 'T-Shirt', ...eventTypeKeys.map(k => EVENT_TYPES[k]!), 'Registered'];

  const data = [
    headers,
    ...players.map((player) => {
      return [
        player.firstName || '',
        player.lastName || '',
        getParticipationLabel(player.participationType),
        player.email || '',
        player.phone || '',
        getGenderDisplay(player.gender),
        player.dateOfBirth ? format(new Date(player.dateOfBirth), 'yyyy-MM-dd') : '',
        player.tshirtSize ? player.tshirtSize.toUpperCase() : '',
        ...eventTypeKeys.map(eventType => getPlayerEventRating(player, eventType, 'numeric')),
        player.createdAt ? format(new Date(player.createdAt), 'yyyy-MM-dd') : '',
      ];
    })
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

const exportPlayersToPDF = async (
  players: PlayerWithDetails[],
  organizationName: string,
  eventYearName?: string
) => {
  await generatePlayersReactPDF(players, organizationName, eventYearName);
};

// Custom DataTableExport component for players
function PlayersDataTableExport({
  players,
  organizationName,
  eventYearName,
  filename
}: {
  players: PlayerWithDetails[];
  organizationName: string;
  eventYearName?: string;
  filename: string;
}) {
  // Exclude deactivated players from exports
  const activePlayers = players.filter(p => p.status !== 'inactive');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 text-sm">
          <DownloadIcon className="size-4 shrink-0" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export data</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => exportPlayersToCSV(activePlayers, filename)}
          className="cursor-pointer"
        >
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportPlayersToExcel(activePlayers, filename)}
          className="cursor-pointer"
        >
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportPlayersToPDF(activePlayers, organizationName, eventYearName)}
          className="cursor-pointer"
        >
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PlayersDataTable({ data, organization, eventYears }: PlayersDataTableProps) {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = React.useState('');

  const handleRefresh = () => {
    router.refresh();
  };

  const columns: ColumnDef<PlayerWithDetails>[] = [
    {
      accessorKey: 'firstName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="First Name" />,
      cell: ({ row }) => {
        const firstName = row.getValue('firstName') as string;
        return <span className="font-medium">{firstName}</span>;
      },
      meta: {
        title: 'First Name'
      },
    },
    {
      accessorKey: 'lastName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Name" />,
      cell: ({ row }) => {
        const lastName = row.getValue('lastName') as string;
        return <span className="font-medium">{lastName}</span>;
      },
      meta: {
        title: 'Last Name'
      },
    },
    {
      accessorKey: 'participationType',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => {
        const type = row.getValue('participationType') as ParticipationType;
        return (
          <Badge variant={type === ParticipationType.SPECTATOR ? 'secondary' : 'default'}>
            {getParticipationLabel(type)}
          </Badge>
        );
      },
      filterFn: 'equals',
      meta: {
        title: 'Role'
      },
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => {
        const email = row.getValue('email') as string;
        return <span className="text-sm">{email}</span>;
      },
      meta: {
        title: 'Email'
      }
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => {
        const phone = row.getValue('phone') as string | null;
        return <span className="text-sm">{formatPhoneNumber(phone)}</span>;
      },
      meta: {
        title: 'Phone'
      }
    },
    {
      accessorKey: 'gender',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Gender" />,
      cell: ({ row }) => getGenderDisplay(row.getValue('gender')),
      meta: {
        title: 'Gender'
      }
    },
    {
      accessorKey: 'dateOfBirth',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Age" />,
      cell: ({ row }) => {
        const dob = row.getValue('dateOfBirth') as Date;
        const age = new Date().getFullYear() - new Date(dob).getFullYear();
        return `${age} years`;
      },
      meta: {
        title: 'Age'
      }
    },
    {
      accessorKey: 'tshirtSize',
      header: ({ column }) => <DataTableColumnHeader column={column} title="T-Shirt" />,
      cell: ({ row }) => {
        const size = row.getValue('tshirtSize') as string;
        return size.toUpperCase();
      },
      meta: {
        title: 'T-Shirt'
      }
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Registered" />,
      cell: ({ row }) => {
        const player = row.original;
        if (player.status === 'inactive') {
          return <Badge variant="destructive">Inactive</Badge>;
        }
        const date = row.getValue('createdAt') as Date;
        return format(new Date(date), 'MMM dd, yyyy');
      },
      meta: {
        title: 'Registered'
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const player = row.original;
        const isInactive = player.status === 'inactive';

        return (
          <div className="text-right flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                NiceModal.show(ViewPlayerDialog, {
                  player,
                  organizationId: organization.id
                });
              }}
            >
              <EyeIcon className="size-4" />
              <span className="sr-only">View Details</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isInactive}
              onClick={() => {
                NiceModal.show(EditPlayerDialog, {
                  player,
                  organizationId: organization.id,
                  onSuccess: handleRefresh
                });
              }}
            >
              <PencilIcon className="size-4" />
              <span className="sr-only">Edit Player</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isInactive}
              onClick={() => {
                NiceModal.show(DeletePlayerDialog, {
                  player,
                  organizationId: organization.id,
                  onSuccess: handleRefresh
                });
              }}
              className="text-destructive hover:text-destructive"
            >
              <UserXIcon className="size-4" />
              <span className="sr-only">Deactivate Player</span>
            </Button>
          </div>
        );
      },
      meta: {
        title: 'Actions'
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];

  // Sort players so inactive ones are at the bottom
  const sortedPlayers = React.useMemo(() => {
    return [...data.players].sort((a, b) => {
      // Inactive players go to the bottom
      if (a.status === 'inactive' && b.status !== 'inactive') return 1;
      if (a.status !== 'inactive' && b.status === 'inactive') return -1;
      // Otherwise maintain original order (by createdAt desc from server)
      return 0;
    });
  }, [data.players]);

  const table = useReactTable({
    data: sortedPlayers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      globalFilter,
      columnVisibility: {},
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  // Headcount over everyone loaded (minus inactive), independent of the role filter
  const participationCounts = countByParticipation(data.players);
  const roleFilter = (table.getColumn('participationType')?.getFilterValue() as string | undefined) ?? 'all';

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search players..."
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="max-w-sm"
          />
          <Select
            value={roleFilter}
            onValueChange={(value) =>
              table.getColumn('participationType')?.setFilterValue(value === 'all' ? undefined : value)
            }
          >
            <SelectTrigger className="w-[150px]" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value={ParticipationType.PLAYER}>Playing</SelectItem>
              <SelectItem value={ParticipationType.SPECTATOR}>Spectating</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            {participationCounts.playing} playing · {participationCounts.spectating} spectating
          </p>
        </div>
        <div className="flex items-center">
          <PlayersDataTableExport
            players={data.players}
            organizationName={organization.name}
            eventYearName={data.players[0]?.eventYear?.name}
            filename={`players-${organization.slug}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`}
          />
          <DataTableColumnOptionsHeader table={table} />
        </div>
      </div>
      <DataTable table={table} />
      <DataTablePagination table={table} />
    </div>
  );
}
