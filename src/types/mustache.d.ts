declare module 'mustache' {
  const Mustache: {
    render(template: string, view: Record<string, any>): string;
  };
  export default Mustache;
}
