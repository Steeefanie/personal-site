import { elementInfo, elements, interpretElement, questions, summarizeResult, type Element, type Score } from './four-elements.ts';
import { readingGroups, readingPlans } from './four-elements-reading.ts';
import { validateAiReport, type AiReport } from './four-elements-ai.ts';

const itemLabels: Record<number, string> = {
  1: '探索陌生领域', 3: '察觉关系变化', 4: '偏爱稳妥方案', 5: '兴趣激发行动', 6: '理解结构原理',
  7: '记忆与意义', 10: '主动带头', 12: '接受长期重复', 14: '重视可执行性', 16: '信息不全时先行动',
  17: '连接不同事物', 20: '挑战自我', 22: '完成承诺', 23: '体验持续影响', 24: '面对阻力推进',
  25: '建立整体框架', 26: '重视关系深度', 27: '形成稳定方法', 29: '接受观点修正',
  31: '重视长期维持', 32: '偏好挑战体验', 33: '记住知识结构', 34: '决策考虑感受', 35: '厘清现实步骤',
};

export function buildNarrativeReport(result: Score, ai?: AiReport) {
  const summary = summarizeResult(result);
  const generatedContent = ai ? validateAiReport(ai) : undefined;
  const value = (id: number) => {
    const q = questions[id - 1];
    return q.type === 'likert' ? result.raw[q.element].items[String(id)] : 0;
  };
  const mean = (ids: number[]) => ids.reduce((total, id) => total + value(id), 0) / ids.length;
  const contrast = (high: number[], low: number[]) => mean(high) >= 4 && mean(low) <= 3 && mean(high) - mean(low) >= 1;
  const profiles = elements.map((element) => {
    const base = interpretElement(result, element);
    let title = result.raw[element].mean >= 4 ? `${elementInfo[element].name}：${elementInfo[element].role}`
      : result.raw[element].mean <= 2 ? `${elementInfo[element].name}：相关偏好较少体现`
        : `${elementInfo[element].name}：不同方面需要分开看`;
    let narrative = base.summary;
    let takeaway = elementInfo[element].boundary;
    let high: number[] = [], low: number[] = [];
    if (element === 'wind' && mean([1, 6, 17, 25, 29, 33]) >= 4 && value(1) >= 4 && mean([6, 25, 33]) >= 4 && value(29) >= 4) {
      title = '风：探索、建模与修正理解';
      narrative = '你不仅认同接触新事物，也认同追问原理、建立框架和修正旧观点。吸引你的不只是新鲜感，还有把事情逐渐弄明白的过程。';
      takeaway = '这组回答更能说明认知探索偏好，不能据此判断社交方式或实际研究能力。';
      high = [1, 6, 17, 25, 29, 33];
    } else if (element === 'water' && contrast([3, 7, 26], [23, 34])) {
      title = '水：感知细腻，感受未必主导选择';
      narrative = '你对关系中的细微变化、记忆承载的意义和真诚的交流较为认同；但体验持续影响自己、决策难以抽离他人感受的评分较低。能接收感受，与让感受持续牵动自己，在这次回答中呈现了不同程度。';
      takeaway = '感知与联结是较明显的部分；不能把这种敏感直接理解为情绪容易失控。';
      high = [3, 7, 26]; low = [23, 34];
    } else if (element === 'water' && contrast([23, 34], [3, 7, 26])) {
      title = '水：感受的延续，比即时感知更突出';
      narrative = '相比察觉关系细节、记忆意义与深度交流，你更认同体验会持续影响自己，以及重要关系中的感受难以被排除。这里呈现的是感受对后续体验和选择的分量，不能简单等同于共情能力。';
      high = [23, 34]; low = [3, 7, 26];
    } else if (element === 'earth' && contrast([14, 22, 27, 35], [4, 12, 31])) {
      title = '土：重视做成，未必天然偏爱稳妥';
      narrative = '可执行性、完成承诺、形成方法和厘清步骤，是你较认同的部分；对稳妥方案和长期维持的偏好相对较弱。你更像是在需要把事情做成时重视秩序，而不一定把稳定本身放在最前面。';
      takeaway = '这组区别来自做事方式与稳定偏好的对照，不代表已验证的执行能力。';
      high = [14, 22, 27, 35]; low = [4, 12, 31];
    } else if (element === 'earth' && contrast([4, 12, 31], [14, 22, 27, 35])) {
      title = '土：更偏爱稳定，落实方式仍有差异';
      narrative = '相比拆解步骤、形成方法和完成承诺，你更认同可靠方案与长期维持。对稳定的偏好和具体做事方式并非完全同步，不能仅凭前者推断后者。';
      high = [4, 12, 31]; low = [14, 22, 27, 35];
    } else if (element === 'fire' && contrast([5], [10, 16, 20, 24, 32])) {
      title = '火：兴趣更容易点燃行动';
      narrative = '你认同真正感兴趣时会想马上去做；相比之下，主动带头、信息不全时先行动，以及挑战或阻力本身的吸引力较弱。你的启动意愿可能更依赖具体对象是否吸引自己，而不是始终保持推进的冲劲。';
      takeaway = '兴趣启动来自第 5 题，仍需结合生活经验理解；相对低火不等于没有行动能力。';
      high = [5]; low = [10, 16, 20, 24, 32];
    } else if (element === 'fire' && contrast([10, 16, 20, 24, 32], [5])) {
      title = '火：推进与挑战，不只依赖兴趣';
      narrative = '相比兴趣带来的即时冲动，你更认同带头、先行动、面对挑战或阻力时推进。需要行动的情境本身可能更容易调动你，不能据此推断你对所有事情都保持同样动力。';
      high = [10, 16, 20, 24, 32]; low = [5];
    }
    const evidence = (ids: number[]) => ids.map((id) => ({ id, label: itemLabels[id], value: value(id) }));
    return { element, ...base, title, narrative, paragraphs: [narrative], takeaway, contrasted: high.length > 0 && low.length > 0,
      evidence: high.length ? evidence(high) : [], comparison: evidence(low) };
  });

  const pairs: { elements: [Element, Element]; title: string; text: string; ids: number[]; winner: Element | null }[] = [];
  for (let i = 0; i < elements.length; i++) for (let j = i + 1; j < elements.length; j++) {
    const a = elements[i], b = elements[j];
    const matched = questions.filter((q) => q.type === 'forced_choice' && [a, b].includes(q.options.A.element) && [a, b].includes(q.options.B.element));
    const aWins = matched.filter((q) => result.forced_detail[String(q.id)].element === a).length;
    const winner = aWins === 2 ? a : aWins === 0 ? b : null;
    pairs.push({ elements: [a, b], ids: matched.map((q) => q.id), winner,
      title: `${elementInfo[a].name}与${elementInfo[b].name}`,
      text: winner ? `两次都选择${elementInfo[winner].name}，这两种情境下更倾向${elementInfo[winner].role}。`
        : '两次选择分别落在不同元素，取舍随情境变化，不宜指定固定优先项。' });
  }
  const leading = profiles.find((profile) => profile.element === result.ranking[0])!;
  const leadStrong = summary.leaders.length === 1 && result.raw[result.ranking[0]].mean >= 4;
  const headline = leadStrong ? leading.title : summary.heading;
  const introduction = leadStrong ? leading.narrative : summary.leaders.length > 1
    ? '这次回答没有拉开明确的单一领先项。与其选一个标签，更值得看各元素内部的差异，以及具体情境中的取舍。'
    : `虽然${elementInfo[result.ranking[0]].name}相对靠前，但它的主体题均分未达到 4 分。排名描述的是内部顺序，不宜把相对第一直接写成强烈偏好。`;
  const conclusion = summary.leaders.length > 1 ? '保留多种倾向，比硬选一种更贴近这次回答。'
    : leadStrong ? `这次回答中，${elementInfo[result.ranking[0]].role}是较突出的倾向。`
      : '先看具体回答，再理解相对排名。';
  const integration: { title: string; text: string }[] = [];
  if (mean([1, 6, 17, 25, 29, 33]) >= 4 && contrast([5], [10, 16, 20, 24, 32])) {
    integration.push({ title: '探索与行动，启动条件不同', text: '你认同深入理解，也认同兴趣带来的行动冲动，但并不对所有带头、冒险或持续推进的情境保持同样热情。把这两组回答放在一起，比“只想不做”更贴近的是：探索偏好较稳定，行动启动更有选择。这里不意味着探索必然先于行动。' });
  }
  if (contrast([3, 7, 26], [23, 34]) && contrast([14, 22, 27, 35], [4, 12, 31])) {
    integration.push({ title: '感知与落实，可以同时存在', text: '你认同察觉关系与意义，也认同可执行性、完成承诺和建立方法；与此同时，感受持续牵动自己与天然偏爱稳妥的评分较低。因此，敏感不必等同于被情绪牵着走，使用秩序也不必等同于偏爱保守。两种区别在这次回答中同时出现。' });
  }
  if (!integration.length) integration.push({ title: '总分之外，保留具体情境', text: '四项总分是对多道题的压缩，不表示每个方面都同样突出。可以把上方元素内部的评分差异，与六组取舍逐一对照；没有同时满足条目对照条件时，不额外指定一种固定的协同模式。' });
  const report = { summary, profiles, pairs, headline, introduction, conclusion, integration,
    coreSentence: '', reflection: '', source: 'rules' as 'rules' | 'ai', overviewEvidenceIds: [] as number[] };
  if (generatedContent) {
    const content = generatedContent;
    report.source = 'ai';
    report.headline = content.overview.headline;
    report.introduction = content.overview.summary;
    report.coreSentence = content.overview.coreSentence;
    report.overviewEvidenceIds = content.overview.evidenceIds;
    profiles.forEach(profile => {
      const generated = content.elements.find(p => p.element === profile.element)!;
      profile.title = generated.title;
      profile.paragraphs = generated.paragraphs;
      profile.narrative = generated.paragraphs.join('\n\n');
      profile.takeaway = generated.nuance;
      profile.contrasted = false;
      profile.comparison = [];
      profile.evidence = generated.evidenceIds.map(id => ({ id,
        label: itemLabels[id] || (questions[id - 1] as { text: string }).text,
        value: result.raw[profile.element].items[String(id)] }));
    });
    pairs.forEach(pair => { pair.text = content.conflicts.find(p => p.pair === pair.elements.join('-'))!.interpretation; });
    report.integration = content.integration.paragraphs.map((text, index) => ({ title: index === 0 ? content.integration.title : '', text }));
    report.conclusion = content.conclusion.summary;
    report.reflection = content.conclusion.reflection;
  }
  const readings = readingPlans(result).map(({ elements: members, layout }, index) => {
    const generated = generatedContent?.readings.find(r => r.elements.join('-') === members.join('-'));
    const grouped = members.map(element => profiles.find(p => p.element === element)!);
    const cards = generated?.cards ?? (members.length > 1 ? grouped.map(profile => ({ element: profile.element,
      title: profile.title, body: [profile.narrative], emphasis: [] as string[] })) : Array.from({ length: layout === 'features' ? 3 : 2 }, (_, i) => ({ element: members[0], title: grouped[0].groups[i]?.title || '具体表现', body: [grouped[0].descriptions[i] || grouped[0].narrative], emphasis: [] as string[] })));
    return { elements: members, layout, cards, emphasis: generated?.emphasis ?? [],
      label: readingGroups(result).length === 1 ? '相近倾向' : index === 0 ? '相对靠前' : index === readingGroups(result).length - 1 ? '相对靠后' : '共同支撑',
      title: generated?.title ?? (members.length === 1 ? grouped[0].title : `${members.map(e => elementInfo[e].name).join('与')}：两种相近而不同的支撑`),
      paragraphs: generated?.paragraphs ?? grouped.flatMap(p => p.paragraphs),
      keySentence: generated?.keySentence ?? grouped.map(p => p.takeaway).join(''),
      evidenceIds: generated?.evidenceIds ?? grouped.flatMap(p => p.evidence.map(e => e.id)),
    };
  });
  return { ...report, readings, overviewEmphasis: generatedContent?.overview.emphasis ?? [], integrationCards: generatedContent?.integration.roles ?? [], integrationEmphasis: generatedContent?.integration.emphasis ?? [], closingCards: generatedContent?.conclusion.highlights ?? [], conclusionEmphasis: generatedContent?.conclusion.emphasis ?? [] };
}
