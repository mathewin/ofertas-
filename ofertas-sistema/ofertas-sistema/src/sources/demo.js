import { shuffle } from '../lib/random.js';

const CATALOG = [
  { title: 'Smart TV 50" 4K UHD Smart LED', category: 'Eletronicos', store: 'Shopee Oficial', base: 2199, floor: 1499 },
  { title: 'Notebook Intel Core i5 16GB SSD 512GB', category: 'Informatica', store: 'Tech Store BR', base: 3499, floor: 2599 },
  { title: 'Fone de Ouvido Bluetooth TWS', category: 'Eletronicos', store: 'Audio Shop', base: 199, floor: 79 },
  { title: 'Smartphone 128GB 6GB RAM', category: 'Celulares', store: 'Mobile Center', base: 1499, floor: 999 },
  { title: 'Monitor Gamer 24" 165Hz', category: 'Informatica', store: 'Gamer House', base: 1099, floor: 749 },
  { title: 'Air Fryer Digital 5L', category: 'Casa', store: 'Casa & Co', base: 499, floor: 299 },
  { title: 'Cafeteira Expresso Compacta', category: 'Casa', store: 'Casa & Co', base: 699, floor: 449 },
  { title: 'Console PlayStation 5 Slim', category: 'Games', store: 'Game World', base: 3999, floor: 3399 },
  { title: 'Controle Sem Fio para Console', category: 'Games', store: 'Game World', base: 449, floor: 249 },
  { title: 'Tenis Esportivo Unissex', category: 'Moda', store: 'Sport Life', base: 299, floor: 149 },
  { title: 'Jaqueta Corta-Vento Impermeavel', category: 'Moda', store: 'Urban Style', base: 259, floor: 129 },
  { title: 'Perfume Importado 100ml', category: 'Beleza', store: 'Beauty Prime', base: 459, floor: 279 },
  { title: 'Kit Skincare Facial Completo', category: 'Beleza', store: 'Beauty Prime', base: 329, floor: 189 },
  { title: 'Aspirador de Po Vertical 2 em 1', category: 'Casa', store: 'Casa & Co', base: 399, floor: 229 },
  { title: 'SSD NVMe 1TB Leitura 3500MB/s', category: 'Informatica', store: 'Hardware BR', base: 649, floor: 389 },
  { title: 'Caixa de Som Bluetooth 40W', category: 'Eletronicos', store: 'Audio Shop', base: 399, floor: 219 },
  { title: 'Tablet 10.1" 128GB Wi-Fi', category: 'Informatica', store: 'Tech Store BR', base: 1299, floor: 899 },
  { title: 'Cadeira Gamer Reclinavel', category: 'Games', store: 'Gamer House', base: 1099, floor: 649 },
  { title: 'Furadeira e Parafusadeira 12V', category: 'Outros', store: 'Ferramentas BR', base: 329, floor: 189 },
  { title: 'Robo Aspirador Inteligente Wi-Fi', category: 'Casa', store: 'Smart Home', base: 1799, floor: 1099 },
];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export const demoSource = {
  id: 'demo',
  name: 'Demonstracao',

  isConfigured() {
    return true;
  },

  async fetchOffers() {
    const highlighted = new Set(shuffle(CATALOG).slice(0, 5).map((product) => product.title));
    const items = [];

    for (const product of CATALOG) {
      const deep = highlighted.has(product.title);
      const price = deep
        ? Math.round(randomBetween(product.floor, product.floor * 1.06) * 100) / 100
        : Math.round(randomBetween(product.floor, product.base * 0.8) * 100) / 100;
      const previous = Math.round(product.base * randomBetween(1.08, 1.35) * 100) / 100;
      const externalId = `demo-${product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;

      items.push({
        source: 'demo',
        external_id: externalId,
        title: product.title,
        description: `Oferta de demonstracao para ${product.title}.`,
        image_url: `/api/placeholder/${encodeURIComponent(externalId)}`,
        price,
        previous_price: previous,
        currency: 'BRL',
        store: product.store,
        category: product.category,
        product_url: `https://example.com/oferta/${encodeURIComponent(externalId)}`,
        affiliate_url: '',
        rating: Math.round(randomBetween(4, 5) * 10) / 10,
        sales: Math.floor(randomBetween(50, 5000)),
        raw: { origin: 'demo', generatedAt: new Date().toISOString() },
      });
    }

    return { items, rawCount: items.length, errors: [] };
  },
};

export default demoSource;
