// Showcase note: the drag-and-drop ranking of the five beach events on the signup form. It
// produced 16,885 interest selections in the 2026 season and drives the event roster builder.
// Being replaced for 2027 after feedback that some players want to opt out of a sport entirely.

'use client';

import * as React from 'react';
import { cn } from '@workspace/ui/lib/utils';
import { GripVerticalIcon } from 'lucide-react';

// dnd-kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';

// Event types (should match the main page)
const EventType = {
  BEACH_VOLLEYBALL: 'beach_volleyball',
  TUG_OF_WAR: 'tug_of_war',
  CORN_TOSS: 'corn_toss',
  BOTE_BEACH_CHALLENGE: 'bote_beach_challenge',
  BEACH_DODGEBALL: 'beach_dodgeball'
} as const;

type EventTypeValue = typeof EventType[keyof typeof EventType];

// Event details for display
const EVENT_DETAILS: Record<EventTypeValue, { name: string; emoji: string }> = {
  [EventType.BEACH_VOLLEYBALL]: { name: 'Beach Volleyball', emoji: '🏐' },
  [EventType.TUG_OF_WAR]: { name: 'Tug of War', emoji: '💪' },
  [EventType.CORN_TOSS]: { name: 'Corn Toss', emoji: '🌽' },
  [EventType.BOTE_BEACH_CHALLENGE]: { name: 'Surf & Turf Rally', emoji: '🏄‍♂️' },
  [EventType.BEACH_DODGEBALL]: { name: 'Beach Dodgeball', emoji: '🔵' }
};

// Sortable item component using dnd-kit
function SortableEventItem({
  event,
  index,
}: {
  event: EventTypeValue;
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center justify-between p-4 bg-background rounded-lg border select-none",
        "cursor-grab active:cursor-grabbing",
        "touch-none", // Prevents scroll interference on touch
        isDragging
          ? "shadow-xl border-primary bg-background scale-[1.02] opacity-95"
          : "hover:shadow-md hover:border-primary/50",
        "transition-shadow"
      )}
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex-shrink-0">
          {index + 1}
        </div>
        <span className="text-lg flex-shrink-0">{EVENT_DETAILS[event].emoji}</span>
        <span className="font-medium truncate">{EVENT_DETAILS[event].name}</span>
      </div>
      <GripVerticalIcon className="size-5 text-muted-foreground flex-shrink-0 ml-2" />
    </div>
  );
}

// Drag-and-drop event ranking component with dnd-kit
interface EventInterestRankingProps {
  value: Record<EventTypeValue, number>;
  onChange: (value: Record<EventTypeValue, number>) => void;
  error?: string;
}

export function EventInterestRanking({
  value,
  onChange,
  error
}: EventInterestRankingProps) {
  const [rankings, setRankings] = React.useState<EventTypeValue[]>(() => {
    // Sort events by their current ranking (1 = highest priority)
    return Object.entries(value || {})
      .sort(([, a], [, b]) => a - b)
      .map(([eventType]) => eventType as EventTypeValue);
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    // Update parent with current rankings
    const newValue = {} as Record<EventTypeValue, number>;
    rankings.forEach((eventType, index) => {
      newValue[eventType] = index + 1; // 1-based ranking
    });
    onChange(newValue);
  }, [rankings, onChange]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRankings((items) => {
        const oldIndex = items.indexOf(active.id as EventTypeValue);
        const newIndex = items.indexOf(over.id as EventTypeValue);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="font-semibold">Rank Your Event Interests</h3>
        <p className="text-sm text-muted-foreground">
          Drag and drop to reorder events by your interest level (1 = most interested)
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext
          items={rankings}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {rankings.map((eventType, index) => (
              <SortableEventItem
                key={eventType}
                event={eventType}
                index={index}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {error && <p className="text-sm text-destructive text-center mt-4">{error}</p>}
    </div>
  );
}