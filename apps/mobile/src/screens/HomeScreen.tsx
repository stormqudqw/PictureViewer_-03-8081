import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { keepPreviousData } from '@tanstack/react-query';
import { trpc } from '../trpc';
import { theme, fmtNumber, dayWord } from '../theme';

type Cargo = 'ltl' | 'ftl' | 'oog';
type Speed = 'std' | 'express';

const FALLBACK_CITIES = [
  { code: 'BNL', name: 'Барнаул' },
  { code: 'NSK', name: 'Новосибирск' },
  { code: 'MSK', name: 'Москва' },
  { code: 'SPB', name: 'Санкт-Петербург' },
  { code: 'EKB', name: 'Екатеринбург' },
  { code: 'KZN', name: 'Казань' },
  { code: 'KRD', name: 'Краснодар' },
  { code: 'VVO', name: 'Владивосток' },
  { code: 'ALA', name: 'Алматы' },
  { code: 'AST', name: 'Астана' },
  { code: 'MNK', name: 'Минск' },
];

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { code: T; name: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
      {options.map((o) => {
        const active = o.code === value;
        return (
          <Pressable
            key={o.code}
            onPress={() => onChange(o.code)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segBtn, active && styles.segBtnActive]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function HomeScreen() {
  const [from, setFrom] = useState('BNL');
  const [to, setTo] = useState('ALA');
  const [weight, setWeight] = useState('850');
  const [volume, setVolume] = useState('2.4');
  const [cargo, setCargo] = useState<Cargo>('ltl');
  const [speed, setSpeed] = useState<Speed>('std');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const citiesQuery = trpc.cities.list.useQuery(undefined, { staleTime: Infinity });
  const cities = citiesQuery.data ?? FALLBACK_CITIES;

  const route = {
    from,
    to,
    weight: Number(weight) || 0,
    volume: Number(volume) || 0,
    cargo,
    speed,
  };

  const estimate = trpc.calc.estimate.useQuery(route, { placeholderData: keepPreviousData });
  const createLead = trpc.leads.create.useMutation();

  const r = estimate.data;
  const distanceText = r && r.distanceKm > 0 ? `${fmtNumber(r.distanceKm)} км` : '—';
  const daysText = r && r.days > 0 ? `≈ ${r.days} ${dayWord(r.days)}` : '—';
  const priceText = r && r.price > 0 ? `≈ ${fmtNumber(r.price)} ₽` : '—';

  const canSubmit = name.trim().length >= 2 && phone.trim().length >= 5;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Brand */}
      <Text style={styles.brand}>Алтай Логистик</Text>
      <Text style={styles.eyebrow}>Россия · Казахстан · Беларусь</Text>
      <Text style={styles.h1}>Доставим груз туда, где вас ждут.</Text>
      <Text style={styles.sub}>
        От 1 кг до фуры. Прозрачный расчёт и один маршрут на весь путь.
      </Text>

      {/* Calculator */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Калькулятор стоимости</Text>

        <Text style={styles.label}>Откуда</Text>
        <Chips options={cities} value={from} onChange={setFrom} />

        <Text style={styles.label}>Куда</Text>
        <Chips options={cities} value={to} onChange={setTo} />

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Вес, кг</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Объём, м³</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={volume}
              onChangeText={setVolume}
            />
          </View>
        </View>

        <Text style={styles.label}>Тип перевозки</Text>
        <Segment
          value={cargo}
          onChange={setCargo}
          options={[
            { value: 'ltl', label: 'Сборный' },
            { value: 'ftl', label: 'Машина' },
            { value: 'oog', label: 'Негабарит' },
          ]}
        />

        <Text style={styles.label}>Скорость</Text>
        <Segment
          value={speed}
          onChange={setSpeed}
          options={[
            { value: 'std', label: 'Стандарт' },
            { value: 'express', label: 'Экспресс' },
          ]}
        />
      </View>

      {/* Result */}
      <View style={styles.result}>
        <Text style={styles.resultRoute}>
          {from} → {to}
        </Text>
        <View style={styles.resultRow}>
          <Text style={styles.resultKey}>Расстояние</Text>
          <Text style={styles.resultVal}>{distanceText}</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.resultKey}>Срок доставки</Text>
          <Text style={styles.resultVal}>{daysText}</Text>
        </View>
        <Text style={styles.priceLabel}>Ориентировочная стоимость</Text>
        <Text style={styles.price}>{priceText}</Text>
        {estimate.isFetching && <ActivityIndicator color={theme.darkMuted} style={{ marginTop: 8 }} />}
      </View>

      {/* Lead form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Оставить заявку</Text>
        {createLead.isSuccess ? (
          <View>
            <Text style={styles.successTitle}>Заявка отправлена</Text>
            <Text style={styles.sub}>Менеджер свяжется с вами в ближайшее время.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Имя</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Как к вам обращаться"
              placeholderTextColor={theme.muted2}
            />
            <Text style={styles.label}>Телефон</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+7 ___ ___-__-__"
              placeholderTextColor={theme.muted2}
            />
            {createLead.isError && (
              <Text style={styles.error}>Не удалось отправить. Попробуйте ещё раз.</Text>
            )}
            <Pressable
              disabled={!canSubmit || createLead.isPending}
              onPress={() =>
                createLead.mutate({ name: name.trim(), phone: phone.trim(), route })
              }
              style={[styles.submit, (!canSubmit || createLead.isPending) && styles.submitDisabled]}
            >
              <Text style={styles.submitText}>
                {createLead.isPending ? 'Отправляем…' : 'Отправить заявку'}
              </Text>
            </Pressable>
            <Text style={styles.consent}>
              Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.
            </Text>
          </>
        )}
      </View>

      <Text style={styles.footer}>© 2026 Алтай Логистик · 8 800 350-12-00</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 64, paddingBottom: 48 },
  brand: { fontSize: 18, fontWeight: '700', color: theme.ink },
  eyebrow: { fontSize: 13, color: theme.muted3, marginTop: 24, letterSpacing: 0.5 },
  h1: { fontSize: 34, fontWeight: '700', color: theme.ink, marginTop: 12, lineHeight: 38 },
  sub: { fontSize: 15, color: theme.muted, marginTop: 12, lineHeight: 22 },

  card: {
    backgroundColor: theme.white,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginTop: 22,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: theme.ink, marginBottom: 6 },
  label: { fontSize: 13, color: theme.muted2, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  input: {
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.ink,
    backgroundColor: theme.white,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: theme.border,
    marginHorizontal: 4,
    backgroundColor: theme.white,
  },
  chipActive: { backgroundColor: theme.ink, borderColor: theme.ink },
  chipText: { fontSize: 14, color: theme.ink, fontWeight: '500' },
  chipTextActive: { color: theme.white },

  segment: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: theme.white,
  },
  segBtnActive: { backgroundColor: theme.ink, borderColor: theme.ink },
  segText: { fontSize: 14, fontWeight: '600', color: theme.ink },
  segTextActive: { color: theme.white },

  result: {
    backgroundColor: theme.ink,
    borderRadius: 16,
    padding: 22,
    marginTop: 14,
  },
  resultRoute: { fontFamily: 'monospace', fontSize: 12, color: '#7E8086', letterSpacing: 1 },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.darkLine,
  },
  resultKey: { fontSize: 13, color: theme.darkMuted },
  resultVal: { fontSize: 18, fontWeight: '600', color: theme.white },
  priceLabel: { fontSize: 13, color: theme.darkMuted, marginTop: 20 },
  price: { fontSize: 38, fontWeight: '700', color: theme.white, marginTop: 4 },

  submit: {
    backgroundColor: theme.ink,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: theme.white, fontSize: 16, fontWeight: '600' },
  consent: { fontSize: 12, color: theme.muted3, marginTop: 12, textAlign: 'center', lineHeight: 16 },
  successTitle: { fontSize: 22, fontWeight: '700', color: theme.ink, marginTop: 10 },
  error: { color: '#C0362C', fontSize: 13, marginTop: 12 },

  footer: { textAlign: 'center', color: theme.muted3, fontSize: 13, marginTop: 32 },
});
