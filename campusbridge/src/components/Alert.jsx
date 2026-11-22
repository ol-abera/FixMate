export default function Alert({ type = 'error', children, style }) {
  if (!children) return null;
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`alert alert--${type}`} style={style}>
      {children}
    </div>
  );
}
