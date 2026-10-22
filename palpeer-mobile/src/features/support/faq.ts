/**
 * Help-center answers. Sourced from operational How-Tos so FAQ and Live Chat stay aligned.
 * Describes only screens/behaviours that exist (R-SP-2). Product should approve wording (SP-1).
 */
import { OPERATIONAL_HOW_TOS, type HowToSection } from './operationalHowTos';

export type FaqItem = { id: string; question: string; answer: string };
export type FaqSection = { id: string; title: string; items: readonly FaqItem[] };

function toFaqSections(sections: readonly HowToSection[]): FaqSection[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    items: section.items.map((item) => ({
      id: item.id,
      question: item.title,
      answer: item.body,
    })),
  }));
}

export const FAQ_SECTIONS: readonly FaqSection[] = toFaqSections(OPERATIONAL_HOW_TOS);

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim();
}

/** Sections whose questions or answers contain every word of the query. */
export function searchFaq(
  query: string,
  sections: readonly FaqSection[] = FAQ_SECTIONS,
): FaqSection[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (words.length === 0) return [...sections];
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const text = normalize(`${item.question} ${item.answer}`);
        return words.every((word) => text.includes(word));
      }),
    }))
    .filter((section) => section.items.length > 0);
}
