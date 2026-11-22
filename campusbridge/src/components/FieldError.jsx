export default function FieldError({ message }) {
  if (!message) return null;
  return <p role="alert" className="field-error">{message}</p>;
}
