import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { UsageRecord } from './usage-record.entity';
import { Quota } from './quota.entity';

/**
 * 用户实体
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  apiKey: string;

  @Column({ default: 'active' })
  status: 'active' | 'suspended' | 'deleted';

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => UsageRecord, (record) => record.user)
  usageRecords: UsageRecord[];

  @OneToMany(() => Quota, (quota) => quota.user)
  quotas: Quota[];
}
