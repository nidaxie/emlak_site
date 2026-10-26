import { Link } from 'wouter';

type YuvaLogoProps = {
  tone?: 'forest' | 'cream' | 'black' | 'white';
  className?: string;
};

const logoAssets = {
  forest: 'yuva-logo.svg',
  cream: 'yuva-logo-inverse.svg',
  black: 'yuva-logo-black.svg',
  white: 'yuva-logo-white.svg',
} satisfies Record<NonNullable<YuvaLogoProps['tone']>, string>;

export function YuvaLogo({ tone = 'forest', className = '' }: YuvaLogoProps) {
  const asset = logoAssets[tone];

  return (
    <Link
      href="/"
      aria-label="YUVA ana sayfa"
      className={`brand inline-flex shrink-0 items-center ${className}`}
      data-testid="link-home"
    >
      <img
        src={`${import.meta.env.BASE_URL}${asset}`}
        alt=""
        aria-hidden="true"
        className="h-11 w-auto max-w-[184px] object-contain"
      />
      <span className="sr-only">YUVA</span>
    </Link>
  );
}
