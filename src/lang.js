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
        keysSkills: 'X - mroźne cięcie &nbsp; C - lodowa tarcza',
        keysMenu: 'I - ekwipunek &nbsp; E - kupiec, tablica zadań &nbsp; F - pełny ekran &nbsp; H - tryb foto',
        hintTouch: 'Przytrzymaj UŻYJ, by strzelić z łuku',
        goal: 'Przejdź Zimowy Las, Lodową Jaskinię i Ruiny Zamku',
        storyIntro: 'Zimowa Klątwa spowiła krainę wiecznym mrozem. Odnajdź jej źródło i połóż jej kres.',
        'story.forest': 'Wilki i ogry strzegą zamarzniętego lasu na granicy krainy.',
        'story.cave': 'Głęboko w Lodowej Jaskini szamani karmią klątwę swoją magią.',
        'story.ruins': 'W Ruinach Zamku czeka Wódz Ogrów, władca tej zmarzniętej ziemi.',
        level: 'Poziom {level}',
        levelUp: 'AWANS! Poziom {level}',
        tap: 'DOTKNIJ',
        start: '{key} - start',
        dead: 'KONIEC GRY',
        retry: '{key} - spróbuj ponownie',
        win: 'ZWYCIĘSTWO!',
        winText: 'Wszystkie krainy oczyszczone',
        again: '{key} - zagraj ponownie',
        summary: 'Czas: {time} &nbsp; Zabójstwa: {kills} &nbsp; Złoto: {gold}',
        continueGame: '{key} - kontynuuj',
        hintBow: 'Przytrzymaj, by naciągnąć łuk, puść by strzelić',
        hintRoll: 'Podczas uniku jesteś nietykalny',
        hintShield: 'Lodowa tarcza blokuje jedno trafienie',
        hintFreeze: 'Mroźne cięcie spowalnia trafionego wroga',
        foes: 'Wrogowie: {killed}/{total}',
        gold: 'Złoto: {gold}',
        cleared: 'Droga wolna, idź w prawo >>',
        exitPrompt: 'DALEJ >>',
        shopPrompt: 'E - sklep',
        boardPrompt: 'E - zadania',
        bag: 'EKWIPUNEK',
        worn: 'założone',
        wear: 'załóż',
        stats: 'Obrona {defense} &nbsp; Mana +{mana} &nbsp; Stamina +{stamina}',
        merchant: 'KUPIEC',
        buy: 'KUP',
        sell: 'SPRZEDAJ',
        nothingToSell: 'Nie masz nic na sprzedaż',
        quests: 'ZADANIA',
        questCollect: 'Zbierz: {item} x{count}',
        questKill: 'Pokonaj: {enemy} x{count}',
        questHint: 'Wybierz zadanie, by je przyjąć. Nagroda przyjdzie sama.',
        questDone: 'Zadanie wykonane!',
        done: 'wykonane',
        btnBag: 'EKW',
        btnShop: 'SKLEP',
        btnQuests: 'MISJE',
        btnRoll: 'UNIK',
        btnUse: 'UŻYJ',
        btnJump: 'SKOK',
        btnFreeze: 'MRÓZ',
        btnShield: 'TARCZA',
        btnFullscreen: 'PEŁNY EKRAN',
        'stage.forest': 'Zimowy Las',
        'stage.cave': 'Lodowa Jaskinia',
        'stage.ruins': 'Ruiny Zamku',
        'enemy.wolf': 'Wilk',
        'enemy.ogre': 'Ogr',
        'enemy.archer': 'Łucznik',
        'enemy.shaman': 'Szaman',
        'enemy.alpha': 'Wilczy Alfa',
        'enemy.chief': 'Wódz ogrów',
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
        keysSkills: 'X - frost strike &nbsp; C - ice shield',
        keysMenu: 'I - inventory &nbsp; E - merchant, quest board &nbsp; F - fullscreen &nbsp; H - photo mode',
        hintTouch: 'Hold USE to shoot the bow',
        goal: 'Cross the Winter Forest, the Ice Cave and the Castle Ruins',
        storyIntro: 'A Winter Curse has wrapped the land in endless frost. Find its source and end it.',
        'story.forest': 'Wolves and ogres guard the frozen forest at the border of the land.',
        'story.cave': 'Deep in the Ice Cave, shamans feed the curse with their magic.',
        'story.ruins': 'In the Castle Ruins waits the Ogre Chief, lord of this frozen land.',
        level: 'Level {level}',
        levelUp: 'LEVEL UP! Level {level}',
        tap: 'TAP',
        start: '{key} - start',
        dead: 'GAME OVER',
        retry: '{key} - try again',
        win: 'VICTORY!',
        winText: 'All lands cleared',
        again: '{key} - play again',
        summary: 'Time: {time} &nbsp; Kills: {kills} &nbsp; Gold: {gold}',
        continueGame: '{key} - continue',
        hintBow: 'Hold to draw the bow, release to shoot',
        hintRoll: "You're untouchable while rolling",
        hintShield: 'The ice shield blocks one hit',
        hintFreeze: 'The frost strike slows the enemy it hits',
        foes: 'Enemies: {killed}/{total}',
        gold: 'Gold: {gold}',
        cleared: 'Path clear, go right >>',
        exitPrompt: 'ONWARD >>',
        shopPrompt: 'E - shop',
        boardPrompt: 'E - quests',
        bag: 'INVENTORY',
        worn: 'worn',
        wear: 'wear',
        stats: 'Armor {defense} &nbsp; Mana +{mana} &nbsp; Stamina +{stamina}',
        merchant: 'MERCHANT',
        buy: 'BUY',
        sell: 'SELL',
        nothingToSell: 'Nothing to sell',
        quests: 'QUESTS',
        questCollect: 'Collect: {item} x{count}',
        questKill: 'Defeat: {enemy} x{count}',
        questHint: 'Pick a quest to take it. The reward comes on its own.',
        questDone: 'Quest complete!',
        done: 'done',
        btnBag: 'BAG',
        btnShop: 'SHOP',
        btnQuests: 'QUESTS',
        btnRoll: 'ROLL',
        btnUse: 'USE',
        btnJump: 'JUMP',
        btnFreeze: 'FROST',
        btnShield: 'SHIELD',
        btnFullscreen: 'FULLSCREEN',
        'stage.forest': 'Winter Forest',
        'stage.cave': 'Ice Cave',
        'stage.ruins': 'Castle Ruins',
        'enemy.wolf': 'Wolf',
        'enemy.ogre': 'Ogre',
        'enemy.archer': 'Archer',
        'enemy.shaman': 'Shaman',
        'enemy.alpha': 'Alpha Wolf',
        'enemy.chief': 'Ogre Chief',
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
    } catch { }
    translatePage()
}
