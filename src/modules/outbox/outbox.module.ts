import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxEvent } from './entities/outbox-event.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { OutboxService } from './services/outbox.service';
import { OutboxPublisherService } from './services/outbox-publisher.service';

/**
 * Owns OutboxEvent/ProcessedEvent persistence, OutboxService (the writer
 * every domain service calls inside its own transaction), and
 * OutboxPublisherService (the polling publisher). KafkaModule is @Global()
 * so it does not need to be imported here explicitly (mirrors how
 * TransactionModule is consumed project-wide).
 *
 * ScheduleModule.forRoot() is imported here rather than in AppModule
 * because the outbox publisher is the only current consumer of
 * @nestjs/schedule in this codebase — if a future phase needs scheduling
 * elsewhere, forRoot() is idempotent to call once globally, but keeping it
 * scoped to the module that actually needs it matches this codebase's
 * preference for explicit, narrow module boundaries over global
 * side-effecting setup in AppModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent, ProcessedEvent]),
    ScheduleModule.forRoot(),
  ],
  providers: [OutboxService, OutboxPublisherService],
  exports: [OutboxService],
})
export class OutboxModule implements OnModuleInit {
  constructor(private readonly publisher: OutboxPublisherService) {}

  onModuleInit(): void {
    this.publisher.start();
  }
}
