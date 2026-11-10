// Client-safe constants shared between the registration builder (client
// component) and the server data layer. Nothing in this file may import
// server-only modules (next/headers, @/lib/db).

export const CATEGORY_OPTIONS = [
  'event', 'conference', 'workshop', 'training', 'retreat', 'mission-trip',
  'youth-gathering', 'worship-program', 'bible-study', 'volunteer-opportunity', 'camp', 'other',
] as const
export type RegistrationCategory = (typeof CATEGORY_OPTIONS)[number]

export const CATEGORY_LABELS: Record<string, string> = {
  event: 'Event', conference: 'Conference', workshop: 'Workshop', training: 'Training',
  retreat: 'Retreat', 'mission-trip': 'Mission Trip', 'youth-gathering': 'Youth Gathering',
  'worship-program': 'Worship Program', 'bible-study': 'Bible Study',
  'volunteer-opportunity': 'Volunteer Opportunity', camp: 'Camp', other: 'Other',
}

export const FIELD_TYPES = ['text', 'number', 'email', 'phone', 'dropdown', 'checkbox', 'date', 'textarea'] as const
