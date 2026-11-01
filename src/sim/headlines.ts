// Turns a log line into a newspaper headline and deck, for stories that didn't come with one.
import type { EventTag } from "./types";

type Story = { headline: string; deck?: string };

const RULES: [RegExp, (m: RegExpExecArray) => Story][] = [
  [/^(Midterms|Election) \(([^)]+)\): Democrats ([\d.]+)%, Republicans ([\d.]+)% nationally\. House (\d+) D – (\d+) R[^;]*; Senate (\d+) D – (\d+) R/, (m) => {
    const hD = +m[5] > +m[6], sD = +m[7] > +m[8], tie = m[7] === m[8];
    const house = hD ? "Democrats" : "Republicans";
    const senate = tie ? "a 50–50 Senate" : sD === hD ? "the Senate too" : `${sD ? "Democrats" : "Republicans"} the Senate`;
    return { headline: `${house} win the House${tie || sD !== hD ? `, ${senate}` : ` and ${senate}`}`, deck: `House ${m[5]}–${m[6]}, Senate ${m[7]}–${m[8]}; ${m[3]}% to ${m[4]}% in the national vote` };
  }],
  [/^Election \(([^)]+)\): (.+?) wins the presidency/, (m) => ({ headline: `${m[2]} wins the White House` })],
  [/^(.+?) bill signed into law: now "([^"]+)" \(([^)]+)\)/, (m) => ({ headline: `${m[1]} becomes law: ${m[2]}`, deck: `Final tally ${m[3]}` })],
  [/^President (.+?) vetoed the (.+?) bill/, (m) => ({ headline: `${m[1]} vetoes ${m[2].toLowerCase()} bill` })],
  [/^The (.+?) bill \((.+?)\) failed in the (House|Senate): (.+)\.$/, (m) => ({ headline: `${m[1]} bill dies in the ${m[3]}`, deck: m[4] })],
  [/^(.+?) completed its (\$[\d.]+[KMBT]?) acquisition of (.+?)\.$/, (m) => ({ headline: `${m[1]} closes ${m[2]} takeover of ${m[3]}` })],
  [/^Regulators sued to block (.+?)'s takeover of (.+?);/, (m) => ({ headline: `Regulators block ${m[1]}'s bid for ${m[2]}`, deck: "The deal is dead and the break fee is due" })],
  [/^(.+?) is now in the (.+?) tier\.$/, (m) => ({ headline: `${m[1]} joins the ${m[2]} ranks` })],
  [/^(.+?) (earned|lost) (\$[\d.]+[KMBT]?) in (Q\d) and (beat|missed|met) estimates/, (m) => ({ headline: m[5] === "beat" ? `${m[1]} tops ${m[4]} forecasts, ${m[2]} ${m[3]}` : m[5] === "missed" ? `${m[1]} falls short of ${m[4]} forecasts` : `${m[1]} ${m[2]} ${m[3]} in ${m[4]}, in line with Wall Street`, deck: m[5] === "beat" ? "Shares climb on the results" : m[5] === "missed" ? (m[2] === "earned" ? `Still profitable, ${m[2]} ${m[3]}, but below what analysts wanted` : "Shares slide after the report") : "Results matched expectations" })],
  [/^Scandal at (.+?): (\w+) (.+?) is in the headlines/, (m) => ({ headline: `Scandal engulfs ${m[1]}`, deck: `${m[2]} ${m[3]} at the center of the storm` })],
  [/^(.+?) disclosed a ([\d.]+%) stake in (.+?) and demands: (.+)\.$/, (m) => ({ headline: `${m[1]} takes aim at ${m[3]}`, deck: `With a ${m[2]} stake, the fund wants the company to ${m[4]}` })],
  [/^Proxy fight: (.+?) won (\d+) board seat/, (m) => ({ headline: `Activist ${m[1]} wins ${m[2]} seat${m[2] === "1" ? "" : "s"} in proxy fight` })],
  [/^Proxy fight: shareholders backed management against (.+?)\.$/, (m) => ({ headline: `Shareholders rebuff ${m[1]}` })],
  [/^The board fired CEO (.+?) and named/, (m) => ({ headline: `Board ousts CEO ${m[1]}` })],
  [/^(.+?) is trying to hire away your (\w+), (.+?)\./, (m) => ({ headline: `${m[1]} courts your ${m[2]}`, deck: `${m[3]} has an offer on the table` })],
  [/^(.+?) left to become (.+?)'s (\w+)\.$/, (m) => ({ headline: `${m[1]} jumps to ${m[2]}` })],
  [/^Recession:/, () => ({ headline: "The economy slides into recession", deck: "Consumers and businesses are cutting back" })],
  [/^The recession is over/, () => ({ headline: "Recession ends as growth returns" })],
  [/^(.+?) passed a moratorium on new data centers/, (m) => ({ headline: `${m[1]} bans new data centers`, deck: "Council cites a strained grid" })],
  [/^Net debt is over your credit limit/, () => ({ headline: "Lenders sound the alarm", deck: "Debt is over the credit limit; default looms if it isn't fixed" })],
];

export function headlineFor(text: string, tag?: EventTag): Story | undefined {
  if (!tag) return undefined;
  for (const [re, f] of RULES) {
    const m = re.exec(text);
    if (m) return f(m);
  }
  return undefined;
}
