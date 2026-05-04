export default function BrandLogo({ className = '', variant = 'header' }) {
  const classes = variant === 'login' ? `login-logo ${className}` : className;

  return (
    <img
      alt="Aren Academy logosu"
      className={classes}
      src="/logo.jpeg"
    />
  );
}
