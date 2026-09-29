import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Setting } from 'src/entities';
import { Repository } from 'typeorm';
import {
  APP_FEATURES_SETTINGS_KEY,
  DEFAULT_APP_FEATURES,
  normalizeAppFeatures,
  type AppFeaturesSettings,
} from './app-settings.types';

@Injectable()
export class AppSettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}

  async getFeatures(): Promise<AppFeaturesSettings> {
    const row = await this.settingRepo.findOne({
      where: { key: APP_FEATURES_SETTINGS_KEY },
    });
    if (!row?.value) {
      return structuredClone(DEFAULT_APP_FEATURES);
    }
    try {
      return normalizeAppFeatures(JSON.parse(row.value));
    } catch {
      return structuredClone(DEFAULT_APP_FEATURES);
    }
  }

  async isSmsSendingEnabled(): Promise<boolean> {
    const features = await this.getFeatures();
    return features.smsSendingEnabled;
  }

  async saveFeatures(
    patch: Partial<AppFeaturesSettings>,
  ): Promise<AppFeaturesSettings> {
    const current = await this.getFeatures();
    const next = normalizeAppFeatures({
      ...current,
      ...patch,
    });

    let row = await this.settingRepo.findOne({
      where: { key: APP_FEATURES_SETTINGS_KEY },
    });
    if (!row) {
      row = this.settingRepo.create({
        key: APP_FEATURES_SETTINGS_KEY,
        group: 'app',
        type: 'json',
        value: JSON.stringify(next),
      });
    } else {
      row.value = JSON.stringify(next);
      row.type = 'json';
      row.group = 'app';
    }
    await this.settingRepo.save(row);
    return next;
  }
}
