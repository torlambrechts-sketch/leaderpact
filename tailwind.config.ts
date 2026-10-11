import type { Config } from 'tailwindcss'

/**
 * Tokens (handoff section 4), as CSS variables in app/globals.css. Tailwind 3.4 (owner, A4).
 *
 * The radius scale is a scale: which value a component uses is part of its identity (a chip is 5 or 6,
 * a small button 10, a button 12, an option 14, a card 18, a large card 20, the landing hero 28, a pill
 * round). The 8, 9 and 16 px values are the ones the design uses that the handoff's table left out (B2).
 */
const v = (name: string) => `var(--${name})`

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: { DEFAULT: v('surface'), sunk: v('surface-sunk'), soft: v('surface-soft') },
        bar: v('bar'),
        hero: v('hero'),
        track: v('track'),
        divider: v('divider'),
        rule: { soft: v('rule-soft'), softer: v('rule-softer') },
        line: {
          DEFAULT: v('border'),
          strong: v('border-strong'),
          quiet: v('border-quiet'),
          'card-off': v('border-card-off'),
          dashed: v('border-dashed'),
        },
        ink: v('ink'),
        'text-2': v('text-2'),
        'text-3': v('text-3'),
        muted: v('muted'),
        'chip-off-ink': v('chip-off-ink'),
        'text-body': v('text-body'),
        'nav-ink': v('nav-ink'),
        'link-hover': v('link-hover'),
        accent: {
          DEFAULT: v('accent'),
          strong: v('accent-strong'),
          mid: v('accent-mid'),
          ink: v('accent-ink'),
          deep: v('accent-deep'),
        },
        danger: { DEFAULT: v('danger'), border: v('danger-border') },
        flag: { DEFAULT: v('flag'), bg: v('flag-bg'), ink: v('flag-ink'), icon: v('flag-icon') },
        'step-current': v('step-current'),
        ok: { bg: v('ok-bg'), ink: v('ok-ink') },
        pending: { bg: v('pending-bg'), ink: v('pending-ink') },
        evidence: {
          'strong-bg': v('evidence-strong-bg'),
          'strong-ink': v('evidence-strong-ink'),
          'moderate-bg': v('evidence-moderate-bg'),
          'moderate-ink': v('evidence-moderate-ink'),
          'other-bg': v('evidence-other-bg'),
          'other-ink': v('evidence-other-ink'),
        },
      },
      borderRadius: {
        chip: '5px',
        'chip-lg': '6px',
        r8: '8px',
        r9: '9px',
        'btn-sm': '10px',
        input: '11px',
        'icon-tile': '11px',
        btn: '12px',
        option: '14px',
        r16: '16px',
        card: '18px',
        'card-lg': '20px',
        hero: '28px',
        pill: '99px',
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Figtree', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // handoff section 4, Type
        'landing-headline': ['58px', { lineHeight: '1.03', letterSpacing: '-0.035em', fontWeight: '500' }],
        'section-headline': ['36px', { letterSpacing: '-0.03em', fontWeight: '500' }],
        greeting: ['34px', { letterSpacing: '-0.03em', fontWeight: '500' }],
        // the app's page title (Group, Results, Plan …): in the design on eight pages, not in the handoff
        'page-title': ['32px', { letterSpacing: '-0.03em', fontWeight: '500' }],
        'card-headline': ['28px', { letterSpacing: '-0.02em', fontWeight: '500' }],
        'sub-headline': ['22px', { fontWeight: '500' }],
        'big-number': ['40px', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '700' }],
        micro: ['10.5px', { letterSpacing: '0.05em', fontWeight: '700' }],
      },
      maxWidth: {
        app: '1240px',
        landing: '1360px',
        questionnaire: '640px',
      },
      spacing: {
        gutter: '32px',
      },
    },
  },
  plugins: [],
}

export default config
