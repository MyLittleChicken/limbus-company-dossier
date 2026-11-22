const SYMBOLS={identities:'identity-recruitment.png',egos:'ego-emblem.webp',gifts:'gift-frame.webp',packs:'dungeon-entrance.png'} as const;
/** Representative game UI symbols. Provenance: public/game-ui/sources.json. */
export function CatalogueSymbol({section}:{section:keyof typeof SYMBOLS}){
 return <span className="catalogue-symbol" aria-hidden="true"><img src={`/game-ui/${SYMBOLS[section]}`} alt="" width={32} height={32}/></span>;
}
