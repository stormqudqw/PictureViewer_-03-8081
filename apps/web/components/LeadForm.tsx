'use client';

import { useState } from 'react';
import { trpc } from '../lib/trpc';

export function LeadForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const createLead = trpc.leads.create.useMutation();

  if (createLead.isSuccess) {
    return (
      <div className="form-card">
        <div className="form-success">
          <div className="form-success__icon">
            <div className="form-success__check" />
          </div>
          <div className="form-success__title">Заявка отправлена</div>
          <div className="form-success__text">
            Спасибо! Менеджер свяжется с вами в ближайшее время.
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = () => {
    if (name.trim().length < 2 || phone.trim().length < 5) {
      return;
    }
    createLead.mutate({
      name: name.trim(),
      phone: phone.trim(),
      message: message.trim() || undefined,
    });
  };

  return (
    <div className="form-card">
      <div className="form-fields">
        <div className="form-field">
          <label htmlFor="lead-name">Имя</label>
          <input
            id="lead-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Как к вам обращаться"
          />
        </div>
        <div className="form-field">
          <label htmlFor="lead-phone">Телефон</label>
          <input
            id="lead-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 ___ ___-__-__"
          />
        </div>
        <div className="form-field">
          <label htmlFor="lead-msg">Что нужно перевезти</label>
          <textarea
            id="lead-msg"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Маршрут, вес, габариты"
          />
        </div>
        {createLead.isError && (
          <div className="form-error">
            Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.
          </div>
        )}
        <button className="form-submit" onClick={onSubmit} disabled={createLead.isPending}>
          {createLead.isPending ? 'Отправляем…' : 'Отправить заявку'}
        </button>
        <div className="form-consent">
          Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.
        </div>
      </div>
    </div>
  );
}
