declare module 'pdfmake/build/pdfmake' {
  const pdfMake: { vfs: Record<string, string>; createPdf: (definition: unknown, ...args: unknown[]) => { download: (filename: string) => void } }
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  const fonts: { pdfMake?: { vfs?: Record<string, string> }; vfs?: Record<string, string> }
  export default fonts
}
