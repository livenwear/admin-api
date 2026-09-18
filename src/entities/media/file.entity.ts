import {
  Column,
  Entity,
} from 'typeorm';
import { AbstractEntity } from '../common/abstract.entity';

@Entity({ name: 'files' })
export class FileEntity extends AbstractEntity {
  @Column({ type: 'varchar' })
  bucket: string;

  @Column({ type: 'varchar' })
  objectKey: string;

  @Column({ type: 'varchar' })
  namespace: string;

  @Column({ type: 'varchar' })
  originalName: string;

  @Column({ type: 'varchar' })
  mimeType: string;

  @Column({ type: 'bigint' })
  size: string;

  @Column({ type: 'varchar', nullable: true })
  extension: string | null;

  @Column({ type: 'varchar' })
  publicUrl: string;

  @Column({ type: 'varchar', nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', nullable: true })
  variant: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;
}
