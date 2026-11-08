/**
 * Эмодзи для стикеров: небольшой отобранный набор для разметки схем и досок (реакции, статусы, акценты), а не весь
 * Unicode. Можно вставить любой другой эмодзи как текст в ноду «Текст».
 * Emoji for stickers: a small curated set for marking up diagrams and boards (reactions, statuses, accents), not all of
 * Unicode. Any other emoji can be pasted as text into a Text node.
 */
export const EMOJIS: readonly string[] = [
    // лица / faces
    '🙂', '😀', '😂', '😍', '😎', '🤔', '😮', '😢', '😡', '🥳', '😴', '🤯',
    // жесты / gestures
    '👍', '👎', '👏', '🙏', '💪', '👀', '👋', '🤝',
    // статусы и знаки / statuses and signs
    '✅', '❌', '❓', '❗', '⚠️', '🛑', '⭐', '🔥', '💡', '🎯', '🏁', '🎉',
    // чувства / feelings
    '❤️', '💔', '💬', '🧠',
    // вещи и дела / things and tasks
    '🚀', '📌', '📎', '📝', '📅', '⏰', '🔒', '🔑', '💰', '📈', '📉', '🐞',
    // природа и еда / nature and food
    '🌱', '🌈', '☀️', '🌙', '☕', '🍕',
];

export const DEFAULT_EMOJI = '🙂';
