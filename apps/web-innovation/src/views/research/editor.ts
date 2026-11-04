import type { Topic } from './model';

import { copy } from './model';

// A progress-only mutation must not replace form/file objects still being edited.
export function syncProgress(form: Topic, baseline: Topic, saved: Topic) {
  for (const key of ['progress', 'history', 'revision', 'updatedAt'] as const) {
    Object.assign(form, { [key]: copy(saved[key]) });
    Object.assign(baseline, { [key]: copy(saved[key]) });
  }
}
