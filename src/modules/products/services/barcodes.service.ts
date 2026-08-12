import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantBarcode } from '../entities/product-variant-barcode.entity';
import { BarcodeStatus } from '../entities/barcode-status.enum';
import { CreateBarcodeDto } from '../dto/create-barcode.dto';
import { ProductVariantsService } from './product-variants.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

@Injectable()
export class BarcodesService {
  constructor(
    @InjectRepository(ProductVariantBarcode)
    private readonly barcodeRepository: Repository<ProductVariantBarcode>,
    private readonly productVariantsService: ProductVariantsService,
  ) {}

  async findAllForVariant(
    variantId: string,
    companyId: string,
  ): Promise<ProductVariantBarcode[]> {
    await this.productVariantsService.findByIdInCompany(variantId, companyId);
    return this.barcodeRepository.find({
      where: { variantId, companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<ProductVariantBarcode> {
    const barcode = await this.barcodeRepository.findOne({
      where: { id, companyId },
    });
    if (!barcode) {
      throw new AppException(ErrorCode.NotFound, 'Barcode not found');
    }
    return barcode;
  }

  async create(
    variantId: string,
    companyId: string,
    dto: CreateBarcodeDto,
  ): Promise<ProductVariantBarcode> {
    await this.productVariantsService.findByIdInCompany(variantId, companyId);

    const existing = await this.barcodeRepository.findOne({
      where: { companyId, barcode: dto.barcode },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Barcode already exists for this company',
      );
    }

    const barcode = this.barcodeRepository.create({
      variantId,
      companyId,
      barcode: dto.barcode,
      status: BarcodeStatus.Active,
    });

    return this.barcodeRepository.save(barcode);
  }

  async activate(
    id: string,
    companyId: string,
  ): Promise<ProductVariantBarcode> {
    const barcode = await this.findByIdInCompany(id, companyId);
    barcode.status = BarcodeStatus.Active;
    return this.barcodeRepository.save(barcode);
  }

  async deactivate(
    id: string,
    companyId: string,
  ): Promise<ProductVariantBarcode> {
    const barcode = await this.findByIdInCompany(id, companyId);
    barcode.status = BarcodeStatus.Inactive;
    return this.barcodeRepository.save(barcode);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const barcode = await this.findByIdInCompany(id, companyId);
    await this.barcodeRepository.softRemove(barcode);
  }
}
