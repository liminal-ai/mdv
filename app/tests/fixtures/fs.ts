export const simpleFsStructure = {
  '/root': {
    type: 'directory',
    entries: [
      { name: 'README.md', type: 'file', isSymlink: false },
      { name: 'docs', type: 'directory', isSymlink: false },
      { name: 'script.sh', type: 'file', isSymlink: false },
      { name: 'image.png', type: 'file', isSymlink: false },
    ],
  },
  '/root/docs': {
    type: 'directory',
    entries: [
      { name: 'guide.md', type: 'file', isSymlink: false },
      { name: '.hidden.md', type: 'file', isSymlink: false },
      { name: 'component.mdx', type: 'file', isSymlink: false },
    ],
  },
};

export const symlinkFsStructure = {
  '/root': {
    type: 'directory',
    entries: [{ name: 'link.md', type: 'file', isSymlink: true, target: '/outside/real.md' }],
  },
};

export const loopFsStructure = {
  '/root': {
    type: 'directory',
    entries: [{ name: 'self-link', type: 'directory', isSymlink: true, target: '/root' }],
  },
};
