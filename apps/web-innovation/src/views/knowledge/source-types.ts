export type SourceModule = 'competition' | 'exchange' | 'research';
export const sourceNames = {
  exchange: '交流研讨',
  research: '课题攻关',
  competition: '创新竞赛',
};
export interface SourceSelection {
  module: SourceModule;
  parentId: string;
  objectId: string;
  replyIds: string[];
  fileIds: string[];
  parts: string[];
}
export interface SourceLink {
  key: string;
  selection: SourceSelection;
  title: string;
  code?: string;
  parentTitle?: string;
  scope?: string[];
  author: string;
  department: string;
  contributors?: { id: string; name: string; department: string }[];
  fingerprint: string;
  version: string;
  linkedAt: string;
  linkedBy: string;
  fields: string[];
  removed?: boolean;
  published?: boolean;
  reviewedFingerprint?: string;
  observedFingerprint?: string;
  reviewedObservation?: string;
  reviewNote?: string;
  reviewedAt?: string;
  reviewerId?: string;
}
export interface FileOrigin {
  key: string;
  fileId: string;
  copiedAt: string;
  copiedBy: string;
}
