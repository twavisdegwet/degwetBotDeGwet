// Garfield comic delivery messages to add variety and keep America's favorite cat fresh!

export const WAITING_MESSAGES = [
  "here's a nice garfield comic while you wait! 🐱",
  "enjoy this garfield while america's favorite AI thinks! 😴",
  "here's america's most beloved cat to keep you company! 🧡", 
  "garfield comic incoming while I ponder your request! 🤔",
  "orange cat entertainment while the gears turn! ⚙️",
  "have a garfield while I channel my inner genius! 🧠",
  "america's favorite feline keeps you entertained! 🎭",
  "garfield delivery while processing your magnificence! ✨",
  "here's some orange cat therapy while I work! 🛋️",
  "garfield comic to pass the time, courtesy of america's favorite cat! ⏰"
];

export const COMPLETION_MESSAGES = [
  "here's that garfield comic you asked for! 🎉",
  "as promised, america's favorite cat has arrived! 🧡",
  "your garfield comic is here - fresh from the lasagna mines! 🍝", 
  "orange cat delivery complete! 📦",
  "america's most lovable feline, served fresh! 🍽️",
  "here's your dose of garfield goodness! 💊",
  "garfield comic delivery - signed, sealed, delivered! ✉️",
  "your requested orange cat content has arrived! 📬",
  "fresh garfield, hot off the comic press! 🗞️",
  "america's favorite cat reporting for duty! 🫡"
];

export function getRandomWaitingMessage(): string {
  return WAITING_MESSAGES[Math.floor(Math.random() * WAITING_MESSAGES.length)];
}

export function getRandomCompletionMessage(): string {
  return COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];
}