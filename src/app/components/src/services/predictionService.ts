import { nextWordDictionary, commonStartingWords } from '../data/wordData';

export function getSuggestions(input: string): string[] {
  const lastWord = input.split(' ').pop() || '';
  const suggestions = nextWordDictionary[lastWord] || [];
  return suggestions.slice(0, 5); // Return top 5 suggestions
}

export function getCommonStartingWords(): string[] {
  return commonStartingWords;
}