export interface CertificateContent {
  recipient: string;
  projectName: string;
  activityName: string;
  award: string;
  department: string;
  date: string;
  code: string;
}

// 预览和下载使用同一份 SVG；每块内容按实际行数推动后续内容。
export function createCertificateSvg(content: CertificateContent) {
  const escape = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  const texts: string[] = [];
  let y = 235;
  function block(
    value: string,
    size: number,
    nextGap: number,
    color = '#303b50',
  ) {
    // 按完整 Unicode 字符拆行，保守按一个字号宽度计，兼容中文及连续英文。
    const limit = Math.min(32, Math.floor(900 / size));
    const lines = value
      .replaceAll('\r', '')
      .split('\n')
      .flatMap((paragraph) => {
        const chars = [...paragraph];
        return Array.from(
          { length: Math.max(1, Math.ceil(chars.length / limit)) },
          (_, i) => chars.slice(i * limit, (i + 1) * limit).join(''),
        );
      });
    lines.forEach((line, index) => {
      if (index) y += Math.ceil(size * 1.45);
      texts.push(
        `<text x="550" y="${y}" text-anchor="middle" font-size="${size}" fill="${color}">${escape(line)}</text>`,
      );
    });
    y += nextGap;
  }
  block(content.recipient, 27, 80);
  block(`项目《${content.projectName}》`, 25, 90);
  block(`在“${content.activityName}”中荣获`, 24, 105);
  block(content.award, 40, 105, '#9c782e');
  block(content.department, 20, 36);
  block(content.date, 18, 53);
  block(`原型演示 · 非正式证书 · ${content.code}`, 15, 76, '#777777');
  const height = Math.max(780, y);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${height}" viewBox="0 0 1100 ${height}">
    <rect width="1100" height="${height}" fill="#fffcf4"/>
    <rect x="32" y="32" width="1036" height="${height - 64}" fill="none" stroke="#bfa16b" stroke-width="3"/>
    <rect x="42" y="42" width="1016" height="${height - 84}" fill="none" stroke="#bfa16b"/>
    <g font-family="Microsoft YaHei, sans-serif"><text x="550" y="150" text-anchor="middle" font-size="52" fill="#9c782e" letter-spacing="12">荣誉证书</text>
    ${texts.join('\n')}</g></svg>`;
}
