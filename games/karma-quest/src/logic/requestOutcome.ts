import { FACTIONS, type KarmaRequest, type KarmaState } from './karma';

const COPY: Record<string, [string, string]> = {
  village_food: ['食料を支援しました', '食料が村へ届き、\n人々の暮らしを支えました。'],
  warrior_iron: ['鉄を届けました', '鍛冶場に鉄が届き、\n戦士たちの武器作りが進みます。'],
  warrior_train: ['訓練を認めました', '戦士たちが実戦に備え、\n腕を磨く機会を得ました。'],
  merchant_monster: ['護衛を派遣しました', '商人に護衛がつき、\n行商を再開する道が開けました。'],
  merchant_toll: ['通行料を減免しました', '関所を通る負担が軽くなり、\n商人たちの往来を助けました。'],
  outlaw_gold: ['酒代を与えました', '荒くれ者の頼みを聞き、\n彼らの支持を得ました。'],
  outlaw_fight: ['挑戦を認めました', '荒くれ者たちが力を振るう\n機会を得ました。'],
  mage_stone: ['魔石を与えました', '魔術師に魔石が届き、\n研究を進められるようになりました。'],
  mage_book: ['禁書を許可しました', '魔術師に書庫が開かれ、\n新たな研究への道が開けました。'],
};

export function requestOutcome(request: KarmaRequest, accepted: boolean, before: KarmaState, after: KarmaState) {
  const [title, body] = COPY[request.id] ?? ['依頼を引き受けました', '依頼者の願いに応えました。'];
  return {
    faction: request.faction,
    requestId: request.id,
    title: accepted ? title : '支援を見送りました',
    body: accepted ? body : '今回の依頼は引き受けず、\n他の派閥が力を増しました。',
    quote: accepted ? '「力を貸してくれて、ありがとう」' : '「今回は、力を借りられないのですね」',
    deltas: FACTIONS.map(faction => after[faction] - before[faction]),
  };
}
