export function buildExampleUserPrompt(word) {
  return [
    "Create exactly 3 Spanish example sentences for this vocabulary word.",
    `Spanish word: ${word.es}`,
    `Russian translation: ${word.ru}`,
    "You may slightly change the word form if the base form is rarely used on its own.",
    "For example, if the word is an infinitive like costar, you may use cuesta or cuestan in the sentence.",
    "The 3 examples must cover different usage scenarios of the word.",
    'Each example must strictly follow this format: "¿Quieres venir conmigo? — Ты хочешь пойти со мной?"',
    "Put exactly one empty line between examples.",
    "Return only the 3 formatted examples and nothing else."
  ].join("\n");
}

export function buildExampleMessages(word) {
  return [{ role: "user", content: buildExampleUserPrompt(word) }];
}
