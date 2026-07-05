import { Module } from '@nestjs/common';
import { InvitationsModule } from '../invitations/invitations.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [InvitationsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
