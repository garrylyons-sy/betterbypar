import type {CSSProperties, ReactNode} from 'react';
import {CalendarDays, Flag, LockKeyhole, Target} from 'lucide-react';
import {buildClubTheme} from '@/lib/club-theme.mjs';
import styles from './auth-welcome.module.css';

/** Public entry uses platform branding before a member's club is known. */
export function AuthWelcome({children}: {children: ReactNode}) {
  return <main className={styles.page} style={buildClubTheme('#061F3E', '#0878E8') as CSSProperties}>
    <header className={styles.header}>
      <a href="/" aria-label="Better By Par home" className={styles.logo}><img src="/brand/better-by-par-logo.png" alt="Better By Par Golf" width="212" height="106"/></a>
      <span className={styles.privateLabel}><LockKeyhole size={14} aria-hidden="true"/> Invitation only</span>
    </header>
    <div className={styles.layout}>
      <section className={styles.welcome} aria-labelledby="welcome-title">
        <svg className={styles.course} viewBox="0 0 700 800" fill="none" aria-hidden="true">
          <path d="M760 260C470 90 160 300 318 480S770 430 670 720 150 930-70 710"/>
          <path d="M760 300C480 140 210 310 355 460S790 480 710 720 150 980-100 750"/>
          <path d="M760 340C520 190 260 320 395 450S810 530 750 750 170 1020-100 800"/>
          <path d="M760 380C550 240 310 330 435 440S830 580 790 780 190 1060-100 850"/>
          <ellipse cx="500" cy="650" rx="118" ry="52" className={styles.green}/>
          <ellipse cx="500" cy="650" rx="10" ry="4" fill="white" opacity=".5" stroke="none"/>
          <path d="M500 646V518" className={styles.flagpole}/>
          <path d="M502 518L556 538L502 559Z" className={styles.flag}/>
          <circle cx="433" cy="679" r="8" fill="white" stroke="none"/>
        </svg>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Your club. Your game.</span>
          <h1 id="welcome-title">Good golf starts<br/>with <span>better connections.</span></h1>
          <p>Your game, your professional and your club.<br className={styles.desktopBreak}/> All together in Better By Par.</p>
        </div>
        <div className={styles.features}>
          <div><CalendarDays aria-hidden="true"/><span>Make time for lessons</span></div>
          <div><Flag aria-hidden="true"/><span>Keep every round in view</span></div>
          <div><Target aria-hidden="true"/><span>Build a better practice routine</span></div>
        </div>
      </section>
      <section className={styles.access} aria-label="Account access">
        {children}
        <div className={styles.invitation}>
          <span className={styles.lock}><LockKeyhole size={19} aria-hidden="true"/></span>
          <div><h3>A place in your club starts with an invite.</h3><p>Better By Par is invitation only. Use the invitation email from your club to activate your account. Need access? Contact your club administrator or golf professional.</p></div>
        </div>
      </section>
    </div>
    <footer className={styles.footer}><span>Better By Par Golf</span><span>Closer to your club. Better for your game.</span></footer>
  </main>;
}
