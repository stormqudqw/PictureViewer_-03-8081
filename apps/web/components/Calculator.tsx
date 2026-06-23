'use client';

import { useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '../lib/trpc';
import { fmtNumber, dayWord, FALLBACK_CITIES } from '../lib/format';

type Cargo = 'ltl' | 'ftl' | 'oog';
type Speed = 'std' | 'express';

export function Calculator() {
  const [from, setFrom] = useState('BNL');
  const [to, setTo] = useState('ALA');
  const [weight, setWeight] = useState('850');
  const [volume, setVolume] = useState('2.4');
  const [cargo, setCargo] = useState<Cargo>('ltl');
  const [speed, setSpeed] = useState<Speed>('std');

  const citiesQuery = trpc.cities.list.useQuery(undefined, {
    staleTime: Infinity,
  });
  const cities = citiesQuery.data ?? FALLBACK_CITIES;

  const estimateQuery = trpc.calc.estimate.useQuery(
    {
      from,
      to,
      weight: Number(weight) || 0,
      volume: Number(volume) || 0,
      cargo,
      speed,
    },
    { placeholderData: keepPreviousData },
  );

  const result = estimateQuery.data;
  const distanceText = result && result.distanceKm > 0 ? `${fmtNumber(result.distanceKm)} км` : '—';
  const daysText =
    result && result.days > 0 ? `≈ ${result.days} ${dayWord(result.days)}` : '—';
  const priceText =
    result && result.price > 0 ? `≈ ${fmtNumber(result.price)} ₽` : '—';
  const routeCode = `${from} → ${to}`;

  const seg = (active: boolean) => `${active ? 'is-active' : ''}`;

  return (
    <div className="calc__grid">
      <div className="calc__inputs">
        <div className="calc__fields">
          <div className="field">
            <label htmlFor="calc-from">Откуда</label>
            <select id="calc-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              {cities.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="calc-to">Куда</label>
            <select id="calc-to" value={to} onChange={(e) => setTo(e.target.value)}>
              {cities.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="calc-weight">Вес, кг</label>
            <input
              id="calc-weight"
              type="number"
              min={1}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="calc-volume">Объём, м³</label>
            <input
              id="calc-volume"
              type="number"
              min={0}
              step={0.1}
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
          </div>
        </div>

        <div className="calc__sub">
          <label>Тип перевозки</label>
          <div className="seg">
            <button className={seg(cargo === 'ltl')} onClick={() => setCargo('ltl')}>
              Сборный груз
            </button>
            <button className={seg(cargo === 'ftl')} onClick={() => setCargo('ftl')}>
              Отдельная машина
            </button>
            <button className={seg(cargo === 'oog')} onClick={() => setCargo('oog')}>
              Негабарит
            </button>
          </div>
        </div>

        <div className="calc__sub">
          <label>Скорость</label>
          <div className="seg">
            <button className={seg(speed === 'std')} onClick={() => setSpeed('std')}>
              Стандарт
            </button>
            <button className={seg(speed === 'express')} onClick={() => setSpeed('express')}>
              Экспресс
            </button>
          </div>
        </div>
      </div>

      <div className="calc__result">
        <div>
          <div className="calc__route mono">{routeCode}</div>
          <div className="calc__row calc__row--first">
            <div className="k">Расстояние</div>
            <div className="v">{distanceText}</div>
          </div>
          <div className="calc__row">
            <div className="k">Срок доставки</div>
            <div className="v">{daysText}</div>
          </div>
        </div>
        <div>
          <div className="calc__price-label">Ориентировочная стоимость</div>
          <div className="calc__price">{priceText}</div>
          <a className="calc__cta" href="#contact">
            Оформить заявку
          </a>
        </div>
      </div>
    </div>
  );
}
