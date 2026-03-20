declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';

  export interface MarkdownItTaskListOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }

  const markdownItTaskLists: (md: MarkdownIt, options?: MarkdownItTaskListOptions) => void;

  export default markdownItTaskLists;
}
