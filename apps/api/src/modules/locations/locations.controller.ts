import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('cities')
  cities() {
    return this.locations.cities();
  }

  @Get('cities/:cityId/districts')
  districts(@Param('cityId', ParseUUIDPipe) cityId: string) {
    return this.locations.districts(cityId);
  }

  @Get('districts/:districtId/neighborhoods')
  neighborhoods(@Param('districtId', ParseUUIDPipe) districtId: string) {
    return this.locations.neighborhoods(districtId);
  }
}
