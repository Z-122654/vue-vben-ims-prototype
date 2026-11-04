import { describe, expect, it } from 'vitest';

import { createCertificateSvg } from './certificate';

const base = {
  recipient: '林知远',
  projectName: '泵组测点优化',
  activityName: '创新成果评比',
  award: '一等奖',
  department: '科技管理部',
  date: '2026-10-27',
  code: 'ZP-DEMO-001',
};
describe('演示证书排版', () => {
  it.each([
    base,
    {
      ...base,
      projectName: '项目'.repeat(100),
      activityName: '活动'.repeat(40),
    },
    {
      ...base,
      projectName: 'W'.repeat(200),
      award: '创新优秀成果奖'.repeat(20),
    },
  ])(
    '完整保留内容，行与区块不重叠且都在画布边框内：$projectName',
    (content) => {
      const svg = new DOMParser().parseFromString(
        createCertificateSvg(content),
        'image/svg+xml',
      );
      expect(svg.querySelector('parsererror')).toBeNull();
      const texts = [...svg.querySelectorAll('text')];
      const joined = texts.map((t) => t.textContent).join('');
      for (const value of Object.values(content))
        expect(joined).toContain(value);
      expect(joined).toContain('非正式证书');
      const height = Number(svg.documentElement.getAttribute('height'));
      texts.forEach((text, index) => {
        const y = Number(text.getAttribute('y'));
        const size = Number(text.getAttribute('font-size'));
        expect(y).toBeLessThan(height - 42);
        if (index)
          expect(y - size).toBeGreaterThan(
            Number(texts[index - 1]!.getAttribute('y')),
          );
      });
      if (content.projectName.length === 200)
        expect(height).toBeGreaterThan(780);
    },
  );

  it('特殊字符转义、换行及 Unicode 字符完整，不能注入 SVG 标签', () => {
    const projectName = `${'改进<&"🚀'.repeat(12)}\n第二行`;
    const svg = new DOMParser().parseFromString(
      createCertificateSvg({ ...base, projectName }),
      'image/svg+xml',
    );
    const joined = [...svg.querySelectorAll('text')]
      .map((t) => t.textContent)
      .join('');
    expect(svg.querySelector('parsererror')).toBeNull();
    expect(svg.querySelector('script')).toBeNull();
    expect(joined).toContain(projectName.replaceAll('\n', ''));
    expect(joined).not.toContain('\uFFFD');
  });
});
