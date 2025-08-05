// data/dzongkhag.ts

export type Dzongkhag = {
  name: string;
  lat: number;
  lon: number;
};

export const dzongkhagCenters: Dzongkhag[] = [
  { name: "Thimphu", lat: 27.4728, lon: 89.639 },
  { name: "Paro", lat: 27.4305, lon: 89.4131 },
  { name: "Punakha", lat: 27.6, lon: 89.9 },
  { name: "Gasa", lat: 27.9985, lon: 89.7246 },
  { name: "Haa", lat: 27.3845, lon: 89.2806 },
  { name: "Chhukha", lat: 26.8684, lon: 89.3893 },
  { name: "Dagana", lat: 27.0769, lon: 89.8878 },
  { name: "Tsirang", lat: 27.0126, lon: 90.1223 },
  { name: "Wangdue Phodrang", lat: 27.4794, lon: 89.8991 },
  { name: "Bumthang", lat: 27.5495, lon: 90.7321 },
  { name: "Trongsa", lat: 27.5039, lon: 90.5086 },
  { name: "Zhemgang", lat: 27.2155, lon: 90.6622 },
  { name: "Sarpang", lat: 26.8620, lon: 90.2718 },
  { name: "Gelephu", lat: 26.8837, lon: 90.5084 }, // sub-town under Sarpang
  { name: "Mongar", lat: 27.2745, lon: 91.2403 },
  { name: "Lhuentse", lat: 27.6679, lon: 91.1839 },
  { name: "Trashigang", lat: 27.3333, lon: 91.55 },
  { name: "Trashiyangtse", lat: 27.6102, lon: 91.4973 },
  { name: "Pemagatshel", lat: 27.0, lon: 91.35 },
  { name: "Samdrup Jongkhar", lat: 26.8, lon: 91.25 },
];
