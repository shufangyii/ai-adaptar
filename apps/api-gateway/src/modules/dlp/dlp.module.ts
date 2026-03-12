import { Module, Global } from '@nestjs/common';
import { DlpService } from './dlp.service';

@Global()
@Module({
  providers: [DlpService],
  exports: [DlpService],
})
export class DlpModule {}
