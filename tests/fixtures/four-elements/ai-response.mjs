// Explicitly synthetic fixture, never a substitute for a real provider response.
export function mockAiReport() {
  const paragraph = '这是一段仅用于自动测试的模拟解读，目的是检查逐题依据、内容布局和报告保存，并不代表真实模型生成的个人结论。';
  const card = (title, element) => ({ title, ...(element ? { element } : {}), body: ['这是一条仅供自动测试使用的卡片说明，不代表真实个性分析。'], emphasis: ['自动测试'] });
  return {
    version: 'deepseek-report-v3',
    overview: { headline: '自动测试专用的模拟解读标题', summary: paragraph + paragraph, coreSentence: '此句仅用于测试整体概括的布局，不代表真实人工智能分析。', emphasis: ['自动测试'], evidenceIds: [1, 5, 25] },
    elements: [ ['wind', [1, 6]], ['water', [3, 7]], ['earth', [4, 14]], ['fire', [2, 5]] ].map(([element, evidenceIds]) => ({ element, title: '自动测试使用的模拟元素解读标题', paragraphs: [paragraph, paragraph], nuance: '这是一条测试用的补充描述，只有真实调用后才能评价个性化解读质量。', evidenceIds })),
    conflicts: [['wind-water', [40, 46]], ['wind-earth', [41, 47]], ['wind-fire', [37, 43]], ['water-earth', [42, 48]], ['water-fire', [38, 44]], ['earth-fire', [39, 45]]].map(([pair, evidenceIds]) => ({ pair, interpretation: paragraph, evidenceIds })),
    readings: [ ['wind', [1, 6]], ['water-earth', [3, 14]], ['fire', [2, 5]] ].map(([members, evidenceIds]) => ({ elements: members.split('-'), layout: members === 'wind' ? 'features' : members.includes('-') ? 'paired' : 'contrast', cards: members.includes('-') ? members.split('-').map(e => card('自动测试卡片', e)) : Array.from({ length: members === 'wind' ? 3 : 2 }, () => card('自动测试卡片')), emphasis: ['自动测试'], title: '自动测试使用的模拟分组解读标题', paragraphs: [paragraph, paragraph], keySentence: '这句话仅用于自动测试，不代表真实模型对个人作答的分析结论。', evidenceIds })),
    integration: { roles: ['wind','water','earth','fire'].map(e => card('自动测试角色', e)), emphasis: ['自动测试'], title: '自动测试使用的模拟综合解读标题', paragraphs: [paragraph, paragraph], evidenceIds: [1, 5, 25] },
    conclusion: { highlights: Array.from({ length: 3 }, () => card('自动测试提醒')), emphasis: ['自动测试'], summary: paragraph, reflection: '这是一段测试用的观察提示，不应被当作真实模型对个人的判断。', evidenceIds: [1, 5] },
  };
}
