// Texts shown to the player. To add a language copy one block under a new code and translate the values.
const TEXTS = {
  pl: {
    languageName: 'Polski',
    language: 'Język',
    title: 'MROŹNE OSTRZE',
    loading: 'Ładowanie...',
    rotate: 'Obróć telefon poziomo',
    keysMove: 'STRZAŁKI - ruch i skok &nbsp; SHIFT - unik',
    keysUse: 'SPACJA - użyj, przytrzymaj z łukiem &nbsp; 1-9 - wybór',
    keysMenu: 'I - ekwipunek &nbsp; E - sklep u kupca &nbsp; F - pełny ekran',
    hintTouch: 'Przytrzymaj UŻYJ, by strzelić z łuku',
    goal: 'Pokonaj wszystkich wrogów',
    tap: 'DOTKNIJ',
    start: '{key} - start',
    dead: 'KONIEC GRY',
    retry: '{key} - spróbuj ponownie',
    win: 'ZWYCIĘSTWO!',
    winText: 'Wszyscy wrogowie pokonani',
    again: '{key} - zagraj ponownie',
    counter: 'Wrogowie: {killed}/{total} | Złoto: {gold}',
    shopPrompt: 'E - sklep',
    bag: 'EKWIPUNEK',
    worn: 'założone',
    wear: 'załóż',
    stats: 'Obrona {defense} &nbsp; Mana +{mana} &nbsp; Stamina +{stamina}',
    merchant: 'KUPIEC',
    buy: 'KUP',
    sell: 'SPRZEDAJ',
    nothingToSell: 'Nie masz nic na sprzedaż',
    btnBag: 'EKW',
    btnShop: 'SKLEP',
    btnRoll: 'UNIK',
    btnUse: 'UŻYJ',
    btnJump: 'SKOK',
    btnFullscreen: 'PEŁNY EKRAN',
    'item.gold': 'Złoto',
    'item.arrows': 'Strzały',
    'item.potion': 'Mikstura',
    'item.fur': 'Wilcze futro',
    'item.fang': 'Wilczy kieł',
    'item.helmet': 'Hełm',
    'item.armor': 'Kolczuga',
    'item.robe': 'Szata szronu',
    'item.cloak': 'Futrzany płaszcz',
  },
  en: {
    languageName: 'English',
    language: 'Language',
    title: 'FROST BLADE',
    loading: 'Loading...',
    rotate: 'Rotate your phone',
    keysMove: 'ARROWS - move and jump &nbsp; SHIFT - roll',
    keysUse: 'SPACE - use, hold with bow &nbsp; 1-9 - select',
    keysMenu: 'I - inventory &nbsp; E - shop at merchant &nbsp; F - fullscreen',
    hintTouch: 'Hold USE to shoot the bow',
    goal: 'Defeat all enemies',
    tap: 'TAP',
    start: '{key} - start',
    dead: 'GAME OVER',
    retry: '{key} - try again',
    win: 'VICTORY!',
    winText: 'All enemies defeated',
    again: '{key} - play again',
    counter: 'Enemies: {killed}/{total} | Gold: {gold}',
    shopPrompt: 'E - shop',
    bag: 'INVENTORY',
    worn: 'worn',
    wear: 'wear',
    stats: 'Armor {defense} &nbsp; Mana +{mana} &nbsp; Stamina +{stamina}',
    merchant: 'MERCHANT',
    buy: 'BUY',
    sell: 'SELL',
    nothingToSell: 'Nothing to sell',
    btnBag: 'BAG',
    btnShop: 'SHOP',
    btnRoll: 'ROLL',
    btnUse: 'USE',
    btnJump: 'JUMP',
    btnFullscreen: 'FULLSCREEN',
    'item.gold': 'Gold',
    'item.arrows': 'Arrows',
    'item.potion': 'Potion',
    'item.fur': 'Wolf fur',
    'item.fang': 'Wolf fang',
    'item.helmet': 'Helmet',
    'item.armor': 'Chainmail',
    'item.robe': 'Frost robe',
    'item.cloak': 'Fur cloak',
  },
}

function saved() {
  try {
    return localStorage.getItem('language')
  } catch {
    return null
  }
}

let current = [saved(), navigator.language.slice(0, 2)].find(code => code in TEXTS) ?? 'en'

export const LANGUAGES = Object.keys(TEXTS)
export const language = () => current
export const languageName = code => TEXTS[code].languageName

// Text as HTML with {name} placeholders filled from values. Missing texts fall back to English.
export function t(key, values = {}) {
  return (TEXTS[current][key] ?? TEXTS.en[key]).replace(/\{(\w+)\}/g, (_, name) => values[name])
}

// Fills every element marked with data-text
export function translatePage() {
  document.documentElement.lang = current
  for (const element of document.querySelectorAll('[data-text]')) element.innerHTML = t(element.dataset.text)
}

export function setLanguage(code) {
  current = code
  try {
    localStorage.setItem('language', code)
  } catch {}
  translatePage()
}
