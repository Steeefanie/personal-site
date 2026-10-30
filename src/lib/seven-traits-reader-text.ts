/** Remove formulaic evidence-audit sentences without inventing replacement analysis. */
export function readerFacingText(text: string): string {
  return (text.match(/[^。！？!?]+[。！？!?]*/gu) ?? []).map(sentence => {
    // Keep an already qualified observation when only its trailing clause audits evidence.
    const trailing = sentence.match(/^(.*)[，,；;](?:(?:当前|现有|本次|你的)(?:回答|作答|题目|问卷))(?:尚未|无法|不能|不足以|没有)[^。！？!?]*([。！？!?]*)$/u);
    return trailing && /可能|未必|不一定|也许|或许|不必然|不完全/u.test(trailing[1]) ? trailing[1] + (trailing[2] || '。') : sentence;
  }).filter(sentence => {
    const lead = sentence.trim().replace(/^(?:(?:但|不过|然而|此外|同时|另外|目前|当前|现阶段|仍然|仍|还)[，,：:\s]*)+/u, '');
    if (/^[^，,。！？!?]*(?:时|之前|情况下)[，,]/u.test(lead)) return true;
    if (/^(?:缺少|缺乏)[^，,。！？!?]{0,24}(?:不等于|并不意味着|并不代表|未必意味着|不代表)/u.test(lead)) return true;
    if (/^(?:缺少|缺乏)(?:你|对你|关于你)/u.test(lead)) return false;
    if (/^(?:缺少|缺乏|尚缺|未提供|没有提供|尚未提供|未能提供)[^。！？!?]*(?:信息|资料|证据|背景|细节|过程|经历|观察|做法|描述)/u.test(lead)) return false;
    if (/^(?:(?:现有|当前|本次|这些|你的|这份|目前的)?(?:题目|问卷|作答|回答|信息|材料))(?:中|里)?[，,：:\s]*(?:尚未|没有|未能|并未|未|不足以|无法|不能)/u.test(lead)) return false;
    if (/^(?:尚不清楚|不清楚|尚不了解|不了解|尚不知道|尚无法|暂无法|无法确认|不能确认|无法得知|尚不能判断)/u.test(lead)
      && !/^[^，,。！？!?]*(?:时|之前)[，,]/u.test(lead)) return false;
    return true;
  }).join('').trim();
}

export const readerFacingParagraphs = (paragraphs: string[]) => paragraphs.map(readerFacingText).filter(Boolean);
