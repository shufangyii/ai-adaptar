import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * 配额实体
 */
@Entity('quotas')
export class Quota {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.quotas)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  type: 'monthly' | 'daily' | 'request';

  @Column({ type: 'int', default: 0 })
  limit: number;

  @Column({ type: 'int', default: 0 })
  used: number;

  @Column({ type: 'timestamp' })
  resetAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  /**
   * 获取剩余配额
   */
  get remaining(): number {
    return Math.max(0, this.limit - this.used);
  }

  /**
   * 检查配额是否已用完
   */
  get isExceeded(): boolean {
    return this.used >= this.limit;
  }
}
