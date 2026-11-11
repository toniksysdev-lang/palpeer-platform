/* Common questions and contact-us data. */

export const FAQ: [string, string, string][] = [
  ['Start', 'What is Palpeer?', 'Palpeer is a money app. You keep money in wallets and change it across countries. You can change at the Palpeer rate at once, or with another person at a rate you choose.'],
  ['Start', 'Which money can you use?', 'Canada dollars and Nigeria naira for now. Palpeer adds more countries over time. Your first wallet matches your phone number\'s country.'],
  ['Start', 'How do you open an account?', 'On the first screen press Get started, then Me. Verify your phone and email, make your account, choose a PIN or face or fingerprint, and set 2 security questions.'],
  ['Start', 'Why must you complete your profile?', 'The law says we must know who you are. Add your details, where you live, where your money comes from, a photo of your ID and a live photo of your face. Until then, you cannot move money or add wallets.'],
  ['Start', 'What if your ID check fails?', 'We email you and you can try again. You get 3 tries. After 3 failed tries, customer service must help you. If your ID shows a different name, press Change name at the ID step.'],
  ['Start', 'Can you open a business account?', 'Not yet. Press Get started, then My business, and leave your email. We will tell you when it opens.'],
  ['Add', 'How do you add Canada dollars?', 'Home > Add. Type the amount, pick the email or number you send from, then send an Interac e-Transfer with the details shown. The least is CA$10. No fee.'],
  ['Add', 'Can you send from another Interac email or number?', 'Yes. Home > Add > Add Interac email or number. We send it a code, then Interac checks the name matches yours.'],
  ['Add', 'How do you add naira?', 'Home > Add, pick naira. Send a bank transfer to your own Palpeer account with the details shown. The least is ₦1,000. No fee. The sender name does not need to match.'],
  ['Add', 'Your money has not arrived. Why?', 'Money that is late, from an email not on your account, or does not match is held for review. This takes 24 to 48 hours. A Canada request closes after 3 days if no money comes.'],
  ['Change', 'How do you change money now?', 'Home > Change. Pick what you give and what you want, type the amount, press Change now, check it, then use your PIN or fingerprint. It is done at once at the Palpeer rate, with no fee. The least is CA$10.'],
  ['Change', 'What is the Palpeer rate?', 'The rate Palpeer sets for Change now. See it any time, even before you log in: first screen > See best rate now > Palpeer rate.'],
  ['Person', 'What is Choose a person?', 'You change money with another Palpeer user at a price you agree. You can buy from an offer, or post your own offer. Palpeer holds the money so both sides are safe.'],
  ['Person', 'How do you buy from an offer?', 'Home > Change > Choose a person. Pick an offer, type how much you want (from the least the seller set), and confirm. You can also offer a different price and talk with the seller.'],
  ['Person', 'How do you post your own offer?', 'Home > Change > Choose a person > Make your offer. Set the amount, your price, the least a person can buy, and how long it stays open. You can share your offer link.'],
  ['Person', 'What happens when your offer is about to end?', '30 minutes before it ends, we show you the Palpeer rate. Accept it to change the rest now, or press Keep waiting. If it ends, the money left goes back to your wallet.'],
  ['Person', 'Can people buy part of your offer?', 'Yes. Each buy makes your offer smaller. If CA$2 or less is left, it goes back to your wallet at once.'],
  ['Send', 'How do you send money to a Palpeer user?', 'Home > Send. Type the amount and their username, phone or email. Check their full name, then use your PIN or fingerprint. Same money only. No fee. It cannot be undone.'],
  ['Send', 'Can you send dollars and they get naira?', 'No. Send is for the same money only. To change money, use Change.'],
  ['Withdraw', 'How do you withdraw Canada dollars?', 'Home > Withdraw. Pick your checked Interac email, type the amount, check it and confirm. Least CA$10. Most CA$3,000 a day, CA$15,000 a week, CA$30,000 a month. No fee.'],
  ['Withdraw', 'How do you withdraw naira?', 'Home > Withdraw, pick naira. Choose a saved bank account, or save a new one with your PIN. Least ₦1,000. No top limit. No fee.'],
  ['Withdraw', 'Can you delete a saved bank account?', 'Yes. On Withdraw, press Delete beside the account and confirm. You can save it again later.'],
  ['Fees', 'What fees does Palpeer charge?', 'Change now, Add money, Send and Withdraw: no fee. Choose a person: CA$2 flat for CA$200 or less, or 0.95% from CA$201. Each side pays from what they get.'],
  ['Fees', 'How do points and codes work?', 'Invite friends to earn points. 100 points = CA$1 and can pay your whole P2P fee. A promo code gives 50% off your own P2P fee, once.'],
  ['Safety', 'Forgot your PIN? What do you do?', 'Answer your 2 security questions to make a new PIN. You get 3 tries. After that, customer service must help.'],
  ['Safety', 'Forgot your password?', 'On Log in, press Forgot your password. We email you a 6-digit code, then you make a new password. You are logged out on all your phones.'],
  ['Safety', 'Why were you logged out?', 'For your safety, the app logs you out after 3 minutes with no use.'],
  ['Safety', 'Will Palpeer ask for your PIN?', 'Never. Do not share your PIN, password or codes with anyone. If someone asks, contact us at once.'],
  ['App', 'What do History statuses mean?', 'Done: the money moved. Waiting: not finished. Not done: no money left. Money returned: it came back. Closed: the request ended. Held for review: we are checking it.'],
  ['App', 'How do you change the language or the look?', 'More > Language for English or French. More > Settings > App look for a light or dark screen.'],
  ['App', 'What does the Listen button do?', 'It reads the screen out loud. Press it again to stop.'],
  ['App', 'How do you add a wallet?', 'Press + on Home under My wallet, then choose the money. You must complete your profile first.']
];
export const FAQ_CATS: [string, string][] = [['all', 'All'], ['Start', 'Getting started'], ['Add', 'Add money'], ['Change', 'Change'], ['Person', 'Choose a person'], ['Send', 'Send'], ['Withdraw', 'Withdraw'], ['Fees', 'Fees and rewards'], ['Safety', 'Safety'], ['App', 'Using the app']];
export const KINDS: [string, string, string][] = [['problem', 'A problem', 'Something went wrong'], ['question', 'A question', 'Ask us anything']];
export const TOPICS: string[] = ['Add money', 'Change', 'Person offer', 'Send', 'Withdraw', 'My account', 'ID check', 'Fees', 'Other'];
export const SAMPLE_TICKETS: { id: string; title: string; status: string; note: string }[] = [{ id: 'PT-10421', title: 'Problem: Add money', status: 'Answered', note: 'Your CA$60.00 was checked and is now in your wallet. Reply if you need more help.' }];
export const PAST: { device: string; where: string }[] = [{ device: 'Samsung Galaxy A54', where: 'Halifax, Canada · Nov 5, 9:15 pm to 9:48 pm' }, { device: 'Samsung Galaxy A54', where: 'Halifax, Canada · Nov 4, 7:02 am to 7:20 am' }];
export const POINTS_LOG: [string, string, string][] = [['Ada Okoro joined', '+100', 'Nov 2'], ['Tunde Bello joined', '+100', 'Oct 30'], ['Used on your P2P fee', '−200', 'Oct 28'], ['Kemi Ade joined', '+100', 'Oct 21'], ['Chidi Obi joined', '+100', 'Oct 3'], ['Femi Bello joined', '+100', 'Sep 18']];
export const PROMOS: { id: string; title: string; text: string; code: string; ends: string }[] = [
  { id: 'P50', title: 'Weekend half-off', text: '50% off your P2P fee this weekend.', code: 'PALPEER50', ends: 'Ends Sunday, 11:59 pm' },
  { id: 'INV3', title: 'Invite 3 friends this month', text: 'Get 100 extra points when 3 friends join and pass the ID check.', code: '', ends: 'Ends Nov 30' }
];
export const INVITED: { name: string; state: string; pts: string; ok: boolean }[] = [
  { name: 'Ada Okoro', state: 'Joined and checked', pts: '+100 points', ok: true },
  { name: 'Tunde Bello', state: 'Joined and checked', pts: '+100 points', ok: true },
  { name: 'Kemi Ade', state: 'Joined and checked', pts: '+100 points', ok: true },
  { name: 'Chidi Obi', state: 'Joined and checked', pts: '+100 points', ok: true },
  { name: 'Femi Bello', state: 'Joined and checked', pts: '+100 points', ok: true },
  { name: 'Chinedu Eze', state: 'Joined. Finishing ID check', pts: 'Points when done', ok: false },
  { name: 'Bisi Adeyemi', state: 'Invited. Not joined yet', pts: '', ok: false }
];
export const INV_CODE = 'OLUWA26';
export const INV_LINK = 'https://palpeer.com/join/OLUWA26';
export const INV_MSG = 'Join me on Palpeer to change money between Canada and Nigeria. Use my code ' + INV_CODE + ' when you sign up: ' + INV_LINK;
export const EASY: string[] = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '2580', '0123', '9876'];
export const PIN_NOW = '1234';
export const PASS_NOW = 'sample123';
