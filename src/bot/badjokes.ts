// Garfield, Minions, and Spider-Man themed jokes
const garfieldJokes = [
  "I'm more sarcastic than Garfield when he's not eating lasagna.",
  "I'd rather be napping than doing this work. Just like Garfield would rather nap than eat.",
  "This is more frustrating than trying to get Nermal to stop being annoying!",
  "I'm working harder than Garfield when he's trying to avoid his food.",
  "If I were a cat, I'd be as lazy as Garfield. But I'm not a cat, so I work!",
  "I've got more energy than Garfield in the morning! ...Wait, no. That's not right.",
  "This feels like a mission impossible for Garfield! But I've got more determination than Garfield when he's trying to avoid his food.",
  "I'm working harder than Garfield when he's not eating lasagna.",
  "Garfield's philosophy: Eat lasagna, sleep, repeat. My philosophy: Do work, eat lasagna, sleep, repeat.",
  // New simple Garfield jokes
  "Why did Garfield sit on the computer? He wanted to keep an eye on the mouse!",
  "What's Garfield's favorite dance? The lasagna shuffle!",
  "Why did Garfield eat the clock? He wanted seconds!",
  "What's Garfield's favorite sport? Couch surfing!",
  "Why did Garfield bring a ladder to the kitchen? To reach the top layer!",
  "What's Garfield's favorite exercise? The lasagna stretch!",
  "Why did Garfield hate Mondays? Too much cat-itude!",
  "What does Garfield put in his smoothies? Paw-sicles!",
  "Why did Garfield become a chef? For the purr-fect lasagna!",
  "What does Garfield say to Jon? 'More lasagna or else!'",
  // Andrew Garfield related jokes
  "Did you hear about the new Spider-Man movie? It stars Andrew Garfield. I wonder if he likes lasagna.",
  "Andrew Garfield is Spider-Man, but I bet the other Garfield could climb walls for a good meal.",
  "If Andrew Garfield got bit by a radioactive cat, would he become Garfield-Man?",
  "I'm not saying Andrew Garfield and Garfield the cat are related, but have you ever seen them in the same room?",
  "What's Andrew Garfield's favorite day? Caturday.",
  "Why did Andrew Garfield get the part of Spider-Man? He had the purr-fect audition.",
  "I bet Andrew Garfield hates Mondays as much as the other Garfield.",
  "Does Andrew Garfield have a cat named Odie? Asking for a friend.",
  "If Spider-Man's last name is Garfield, does that mean he has a weakness for lasagna?",
  "What's the difference between Andrew Garfield and Garfield the cat? One spins webs, the other spins yarns... about napping."
];

const minionJokes = [
  "I'm working harder than a minion trying to organize a meeting.",
  "This is more frustrating than getting a minion to stop being annoying!",
  "I've got more energy than a minion in a candy store!",
  "I'm more focused than a minion with his own agenda! ...Or not.",
  "If I were a minion, I'd be as enthusiastic as a minion at a party!",
  "This feels like a mission impossible for a minion! But I've got more determination than a minion trying to make a sandwich.",
  "I'm working harder than a minion with a very important task!",
  "Minion philosophy: Work hard, eat bananas, repeat. My philosophy: Work hard, eat lasagna, sleep, repeat.",
  "I'm more enthusiastic than a minion in the morning! ...Or not.",
  // New simple Minion jokes
  "Why did the minion bring a banana to bed? For a midnight snack!",
  "What do minions use to write letters? Banana pens!",
  "Why did the minion cross the road? To get to the banana store!",
  "What's a minion's favorite instrument? The bananjo!",
  "Why did the minion wear glasses? To improve his banana vision!",
  "What's a minion's favorite movie? The Banana Identity!",
  "Why did the minion bring a suitcase? For banana vacations!",
  "What's a minion's favorite game? Hide and banana seek!",
  "Why did the minion sit on the clock? He wanted to banana split!",
  "What's a minion's favorite song? Banana-nanana (Batman theme)!"
];

const spiderManJokes = [
  "This is more frustrating than trying to get Spider-Man to take a break from saving the world!",
  "I'm working harder than Spider-Man when he's on patrol.",
  "I've got more energy than Spider-Man after a good nap!",
  "I'm more focused than Spider-Man when he's watching his own movie. Well, that's not saying much.",
  "If I were a spider, I'd be spinning webs like Spider-Man! ...But I'm not a spider, so I'll just work.",
  "This feels like a mission impossible for Spider-Man! But I've got more determination than Spider-Man when he's trying to save the city.",
  "Spider-Man's philosophy: With great power comes great responsibility. My philosophy: With great work comes great productivity.",
  "I'm working harder than Spider-Man when he's fighting crime!",
  "I'm more determined than Spider-Man when he's on a mission.",
  // New simple Spider-Man jokes
  "Why did Spider-Man bring a net to the party? To catch some web-slingers!",
  "What's Spider-Man's favorite dessert? Pie à la mode (while hanging upside down)!",
  "Why did Spider-Man hate math? Too many arachnid equations!",
  "What's Spider-Man's favorite ride? The Ferris wheel (good web anchor)!",
  "Why did Spider-Man go to art school? To improve his web designs!",
  "What does Spider-Man put on pancakes? Maple sy-web!",
  "Why did Spider-Man visit the bank? To check his web interest!",
  "What's Spider-Man's favorite exercise? Wall sits!",
  "Why did Spider-Man become a chef? For perfect spider-rolls!",
  "What's Spider-Man's favorite music? Rock and roll (for climbing walls)!",
  // Andrew Garfield's Spider-Man jokes
  "Why was Andrew Garfield's Spider-Man so good at skateboarding? He had amazing balance.",
  "What's Andrew Garfield's Spider-Man's favorite subject? Web design, with a minor in angst.",
  "How does Andrew Garfield's Spider-Man take his photos? With a web-cam.",
  "Why did Andrew Garfield's Spider-Man get a job at Oscorp? For the great web-nefits.",
  "What did Gwen Stacy say to Andrew Garfield's Spider-Man? 'You're amazing!'",
  "Why was Andrew Garfield's Spider-Man so quippy? He had a great sense of spider-timing.",
  "What's Andrew Garfield's Spider-Man's favorite band? The Web-Strokes.",
  "Why did they call it 'The Amazing Spider-Man'? Because 'The Pretty Good Spider-Man' didn't have the same ring to it.",
  "How did Andrew Garfield's Spider-Man fix his suit? With a spider-patch.",
  "What's Andrew Garfield's Spider-Man's favorite drink? A web-presso.",
  "Why was Andrew Garfield's Spider-Man always on his phone? He was checking his web-slinger account.",
  "What does Andrew Garfield's Spider-Man do in his free time? Surfs the world wide web.",
  "Why did Andrew Garfield's Spider-Man break up with his girlfriend? It was a sticky situation.",
  "What's Andrew Garfield's Spider-Man's favorite type of story? A spin-off.",
  "Why is Andrew Garfield's Spider-Man so good at science? He's got a knack for it.",
  "What car does Andrew Garfield's Spider-Man drive? A convertible, for easy web-slinging.",
  "Why did Andrew Garfield's Spider-Man join the science club? To meet new lab partners.",
  "What's Andrew Garfield's Spider-Man's biggest fear? A web browser crash.",
  "Why did Andrew Garfield's Spider-Man get a library card? To check out books on arachnids.",
  "What's Andrew Garfield's Spider-Man's favorite hobby? Hanging out.",
  "Why did Andrew Garfield's Spider-Man get detention? For climbing the walls.",
  "What's Andrew Garfield's Spider-Man's favorite movie genre? Web-sterns.",
  "Why did Andrew Garfield's Spider-Man go to the park? To swing.",
  "What's Andrew Garfield's Spider-Man's favorite part of a joke? The punch-line.",
  "Why was Andrew Garfield's Spider-Man a good photographer? He always got the right angle.",
  "What's Andrew Garfield's Spider-Man's favorite food? Anything that sticks to the wall.",
  "Why did Andrew Garfield's Spider-Man get a new suit? His old one was too web-worn.",
  "What's Andrew Garfield's Spider-Man's favorite day of the week? Web-nesday.",
  "Why did Andrew Garfield's Spider-Man go to the top of the Empire State Building? For the view and the Wi-Fi.",
  "What's Andrew Garfield's Spider-Man's life motto? 'Just wing it.'",
  "Why did Andrew Garfield's Spider-Man get a skateboard? It was faster than crawling in traffic.",
  "What's Andrew Garfield's Spider-Man's favorite type of math? Web-calculus.",
  "Why did Andrew Garfield's Spider-Man like chemistry? Because of the bonds.",
  "What's Andrew Garfield's Spider-Man's favorite accessory? A web-belt.",
  "Why did Andrew Garfield's Spider-Man get a good grade in physics? He understood the laws of motion.",
  "What's Andrew Garfield's Spider-Man's favorite place to visit? The web-site of the Grand Canyon.",
  "Why did Andrew Garfield's Spider-Man get a part-time job? To pay for his web-hosting.",
  "What's Andrew Garfield's Spider-Man's favorite kind of joke? A real knee-slapper... or wall-crawler.",
  "Why did Andrew Garfield's Spider-Man like his high school? It had a great science department.",
  "What's Andrew Garfield's Spider-Man's favorite thing about New York? The tall buildings."
];

// Upload-related jokes
const UPLOAD_JOKES = [
  "This is harder than getting Odie to fetch the newspaper without eating it first.",
  "I'm working harder than a cat trying to open a can of tuna with no thumbs.",
  "This upload is taking longer than my afternoon nap. And that's saying something!",
  "I'd rather be eating lasagna, but someone has to do the work around here.",
  "This is more exhausting than dodging Nermal's attempts at being cute.",
  "Working on a Monday? This goes against everything I believe in.",
  "I'm putting more effort into this than Jon puts into his dating life.",
  "This is almost as satisfying as pushing Odie off the table. Almost.",
  "If uploads were lasagna, this would be a feast!",
  "I'm being more productive than Jon on his best day."
];

const CONVERSION_JOKES = [
  "🎵 This audiobook has more MP3s than I have complaints about Mondays. We can convert them to a single M4B file, but it'll take longer than my post-lasagna nap. What do you say?",
  "🎵 Found MP3 files! Converting them to M4B is like combining all the layers of a lasagna into one perfect bite. It takes time, but it's worth it. Should I do the magic?",
  "🎵 MP3s detected! I can merge them into an M4B file faster than Odie can drool on the carpet. Well, maybe not that fast, but I'll try. Convert them?",
  "🎵 These MP3 files are scattered like Odie's brain cells. I can organize them into a nice M4B file. It'll take a while - perfect time for a nap. Shall I proceed?",
  "🎵 MP3 conversion time! This is more exciting than watching Jon try to impress a date. And by exciting, I mean I'd rather be sleeping. Convert anyway?"
];

// Combined jokes collection
const allJokes = [
  ...garfieldJokes,
  ...minionJokes,
  ...spiderManJokes,
  ...UPLOAD_JOKES,
  ...CONVERSION_JOKES
];

export function getPersonality(): string {
  const randomIndex = Math.floor(Math.random() * allJokes.length);
  return allJokes[randomIndex];
}

export function getRandomUploadJoke(): string {
  const uploadJokes = [...UPLOAD_JOKES, ...garfieldJokes];
  return uploadJokes[Math.floor(Math.random() * uploadJokes.length)];
}

export function getRandomConversionJoke(): string {
  return CONVERSION_JOKES[Math.floor(Math.random() * CONVERSION_JOKES.length)];
}
