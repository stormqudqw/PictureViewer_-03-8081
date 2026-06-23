import { Calculator } from '../components/Calculator';
import { LeadForm } from '../components/LeadForm';

const STATS = [
  { num: '12', label: 'лет на рынке' },
  { num: '480', label: 'машин в собственном парке' },
  { num: '1 500', label: 'городов доставки' },
  { num: '99,4%', label: 'доставок точно в срок', blue: true },
];

const SERVICES = [
  ['Сборные грузы', 'Оплата только за ваш объём, отправка от 1 кг ежедневно.'],
  ['Отдельная машина', 'Прямой рейс под ваш груз без перегрузок и ожидания.'],
  ['Негабаритные грузы', 'Спецтехника, разрешения и сопровождение на маршруте.'],
  ['Склад и хранение', 'Ответственное хранение, комплектация и фулфилмент.'],
  ['Международные · ЕАЭС', 'Казахстан и Беларусь, таможенное оформление под ключ.'],
];

const GEO = [
  {
    name: 'Россия',
    code: 'RU',
    cities: 'Москва · Санкт-Петербург · Екатеринбург · Новосибирск · Казань · Краснодар · Владивосток',
    meta: '1 200+ городов',
  },
  {
    name: 'Казахстан',
    code: 'KZ',
    cities: 'Алматы · Астана · Шымкент · Караганда · Павлодар · Усть-Каменогорск',
    meta: 'от 3 дней в пути',
  },
  {
    name: 'Беларусь',
    code: 'BY',
    cities: 'Минск · Брест · Гомель · Витебск · Гродно · Могилёв',
    meta: 'от 2 дней в пути',
  },
];

const ADVANTAGES = [
  ['01', 'Фиксированная цена', 'Стоимость закрепляется в договоре — без доплат в пути.'],
  ['02', 'Свой автопарк', '480 машин — не зависим от посредников и сроков.'],
  ['03', 'Статус 24/7', 'Отслеживание груза и личный менеджер на связи.'],
  ['04', 'Страхование груза', 'Полная ответственность за сохранность на маршруте.'],
];

const REVIEWS = [
  {
    quote:
      '«Возим оборудование из Барнаула в Алматы каждую неделю — ни одной задержки за два года. Цену называют сразу и не меняют.»',
    name: 'Денис Кравцов',
    role: 'директор по логистике, «СибПром»',
  },
  {
    quote:
      '«Как ИП боялась сложностей с таможней в Беларусь. Здесь всё взяли на себя — я просто отдала груз и получила трек-номер.»',
    name: 'Марина Алиева',
    role: 'владелец магазина, ИП',
  },
];

export default function HomePage() {
  return (
    <>
      {/* NAV */}
      <header className="nav">
        <div className="container nav__inner">
          <a href="#top" className="nav__logo">
            Алтай Логистик
          </a>
          <nav className="nav__links">
            <a href="#calc">Калькулятор</a>
            <a href="#services">Услуги</a>
            <a href="#geo">География</a>
            <a href="#about">О компании</a>
            <a href="#contact">Контакты</a>
          </nav>
          <div className="nav__right">
            <span className="nav__phone">8 800 350-12-00</span>
            <a href="#contact" className="nav__cta">
              Оставить заявку
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="container hero">
        <div className="hero__eyebrow">Россия · Казахстан · Беларусь</div>
        <h1 className="hero__title">
          Доставим груз туда,
          <br />
          где вас ждут<span className="dot">.</span>
        </h1>
        <p className="hero__sub">
          От 1 кг до фуры. Без лишних звонков и скрытых наценок — прозрачный расчёт и один
          маршрут на весь путь.
        </p>
        <div className="hero__actions">
          <a href="#calc" className="btn-dark">
            Рассчитать стоимость
          </a>
          <a href="#services" className="link-arrow">
            Виды перевозок →
          </a>
        </div>
      </section>

      {/* STATS */}
      <section className="section">
        <div className="container stats">
          {STATS.map((s) => (
            <div className="stat" key={s.label}>
              <div className={`stat__num${s.blue ? ' stat__num--blue' : ''}`}>{s.num}</div>
              <div className="stat__label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CALCULATOR */}
      <section id="calc" className="section section--alt">
        <div className="container sec-pad">
          <div className="calc__head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                Калькулятор
              </div>
              <h2 className="sec-title" style={{ maxWidth: 560 }}>
                Узнайте стоимость за 30 секунд
              </h2>
            </div>
            <div className="calc__note">
              Предварительный расчёт по расстоянию, весу и объёму. Точную цену подтвердит
              менеджер.
            </div>
          </div>
          <Calculator />
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="section">
        <div className="container sec-pad">
          <div className="eyebrow" style={{ marginBottom: 40 }}>
            Услуги
          </div>
          <div className="services">
            {SERVICES.map(([name, desc]) => (
              <div className="service" key={name}>
                <span className="service__name">{name}</span>
                <span className="service__desc">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GEOGRAPHY */}
      <section id="geo" className="section section--alt">
        <div className="container sec-pad">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            География
          </div>
          <h2 className="sec-title" style={{ marginBottom: 56, maxWidth: 620 }}>
            Одна сеть на три страны
          </h2>
          <div className="geo__grid">
            {GEO.map((g) => (
              <div className="geo__col" key={g.code}>
                <div className="geo__name">
                  <span>{g.name}</span>
                  <span className="geo__code">{g.code}</span>
                </div>
                <div className="geo__cities">{g.cities}</div>
                <div className="geo__meta">{g.meta}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ADVANTAGES */}
      <section id="about" className="section">
        <div className="container sec-pad">
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Почему нас выбирают
          </div>
          <h2 className="sec-title" style={{ marginBottom: 64, maxWidth: 640 }}>
            Логистика без сюрпризов
          </h2>
          <div className="adv__grid">
            {ADVANTAGES.map(([num, title, desc]) => (
              <div className="adv" key={num}>
                <div className="adv__num">{num}</div>
                <div className="adv__title">{title}</div>
                <div className="adv__desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="section reviews">
        <div className="container sec-pad">
          <div className="reviews__eyebrow">Отзывы клиентов</div>
          <div className="reviews__grid">
            {REVIEWS.map((r) => (
              <div key={r.name}>
                <div className="review__quote">{r.quote}</div>
                <div className="review__author">
                  <div className="review__avatar" />
                  <div>
                    <div className="review__name">{r.name}</div>
                    <div className="review__role">{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="section">
        <div className="container sec-pad contact__grid">
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              Заявка
            </div>
            <h2 className="contact__title">Оставьте заявку — рассчитаем точную стоимость</h2>
            <p className="contact__lead">
              Менеджер свяжется в течение 15 минут в рабочее время и подберёт оптимальный
              маршрут.
            </p>
            <div className="contact__items">
              <div>
                <div className="contact__k">Телефон</div>
                <div className="contact__v">8 800 350-12-00</div>
              </div>
              <div>
                <div className="contact__k">Почта</div>
                <div className="contact__v">info@altay-logistik.ru</div>
              </div>
              <div>
                <div className="contact__k">Офис</div>
                <div className="contact__v contact__v--sm">Барнаул, ул. Промышленная, 28</div>
              </div>
            </div>
          </div>
          <LeadForm />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer__top">
          <div className="footer__brand">
            <div className="footer__brand-name">Алтай Логистик</div>
            <div className="footer__brand-text">
              Грузоперевозки по России, Казахстану и Беларуси. От 1 кг до фуры, с контролем на
              каждом этапе.
            </div>
          </div>
          <div className="footer__cols">
            <div className="footer__col">
              <span className="footer__col-head">УСЛУГИ</span>
              <a href="#services">Сборные грузы</a>
              <a href="#services">Отдельная машина</a>
              <a href="#services">Негабарит</a>
              <a href="#services">Склад</a>
            </div>
            <div className="footer__col">
              <span className="footer__col-head">КОМПАНИЯ</span>
              <a href="#geo">География</a>
              <a href="#about">О нас</a>
              <a href="#contact">Контакты</a>
              <a href="#calc">Калькулятор</a>
            </div>
            <div className="footer__col">
              <span className="footer__col-head">КОНТАКТЫ</span>
              <span className="footer__strong">8 800 350-12-00</span>
              <span>info@altay-logistik.ru</span>
              <span>Барнаул, Промышленная, 28</span>
            </div>
          </div>
        </div>
        <div className="footer__bottom">
          <div className="container footer__bottom-inner">
            <span>© 2026 Алтай Логистик</span>
            <span>Политика конфиденциальности</span>
          </div>
        </div>
      </footer>
    </>
  );
}
