export type ReportFonts = { regular: Uint8Array; semibold: Uint8Array };
let fontRequest: Promise<ReportFonts> | undefined;
export async function loadReportFonts(): Promise<ReportFonts> {
  fontRequest ??= Promise.all(['regular', 'semibold'].map(async name => {
    const response = await fetch(`${import.meta.env?.BASE_URL ?? '/'}fonts/star-report/${name}-cjk.ttf`);
    if (!response.ok) throw new Error('报告字体加载失败，请稍后重试。');
    return new Uint8Array(await response.arrayBuffer());
  })).then(([regular, semibold]) => ({ regular, semibold })).catch(error => { fontRequest = undefined; throw error; });
  return fontRequest;
}
