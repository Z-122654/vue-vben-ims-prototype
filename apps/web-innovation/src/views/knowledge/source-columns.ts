import type { SourceModule } from './source-types';

// Shared business columns for linked rows and the module-specific picker.
export function sourceColumns(module: SourceModule) {
  const column = (title: string, dataIndex: string, width = 150) => ({
    title,
    dataIndex,
    width,
  });
  if (module === 'exchange')
    return [
      column('交流编号', 'code'),
      column('交流标题', 'title', 260),
      column('专业分类', 'category'),
      column('发布人', 'author'),
      column('部门', 'department'),
      column('发布时间', 'time', 180),
      column('状态', 'status'),
    ];
  if (module === 'research')
    return [
      column('课题编号', 'code'),
      column('课题名称', 'parentTitle', 240),
      column('关联对象', 'objectTitle', 240),
      column('课题类别', 'category'),
      column('负责人', 'author'),
      column('负责部门', 'department'),
      column('结题时间', 'time', 180),
      column('状态', 'status'),
    ];
  return [
    column('申报编号', 'code'),
    column('项目名称', 'title', 240),
    column('项目类别', 'category'),
    column('所属活动', 'parentTitle', 240),
    column('项目负责人', 'author'),
    column('部门', 'department'),
    column('公示时间', 'time', 180),
    column('状态', 'status'),
  ];
}
