import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateProductDto } from './update-product.dto';
import { CreateProductDto } from './create-product.dto';
import { toProductResponseDto } from './product-response.dto';
import { Product } from '../entities/product.entity';

describe('product image contract', () => {
  it.each([
    'http://images.example.com/a.jpg',
    'https://localhost/a.jpg',
    'https://127.0.0.1/a.jpg',
    'https://2130706433/a.jpg',
    'https://[::1]/a.jpg',
    'https://10.1.1.1/a.jpg',
    'https://user:password@images.example.com/a.jpg',
    'https://storage.internal/a.jpg',
    'https://server.local/a.jpg',
    'https://localhost.example/a.jpg',
    'javascript:alert(1)',
  ])('rejects unsafe image URL %s in create and update', (imageUrl) => {
    for (const dto of [
      plainToInstance(CreateProductDto, { imageUrl }),
      plainToInstance(UpdateProductDto, { imageUrl }),
    ]) {
      expect(
        validateSync(dto).some((error) => error.property === 'imageUrl'),
      ).toBe(true);
    }
  });

  it.each(['https://images.example.com/product.jpg', null, undefined])(
    'accepts an optional public HTTPS image %s',
    (imageUrl) => {
      expect(
        validateSync(plainToInstance(UpdateProductDto, { imageUrl })),
      ).toEqual([]);
    },
  );

  it('returns the stored image in product responses', () => {
    const product = Object.assign(new Product(), {
      imageUrl: 'https://images.example.com/product.jpg',
    });
    expect(toProductResponseDto(product)).toHaveProperty(
      'imageUrl',
      'https://images.example.com/product.jpg',
    );
  });
});
