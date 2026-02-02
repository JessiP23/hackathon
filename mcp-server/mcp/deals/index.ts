import { Tool, SchemaConstraint } from '@leanmcp/core'
import axios from 'axios'

class NearbyDealsInput {
    @SchemaConstraint({ description: "Latitude" })
    lat!: number;

    @SchemaConstraint({ description: "Longitude" })
    lng!: number;
}

class CreateDealInput {
    @SchemaConstraint({ description: "Vendor ID" })
    vendorId!: string;

    @SchemaConstraint({ description: "Item name" })
    itemName!: string;

    @SchemaConstraint({ description: "Discounted Price" })
    dealPrice!: number;

    @SchemaConstraint({ description: "Deal Expiration ISO timestamp" })
    expiresAt!: string;
}

export class DealsService {
    @Tool ({
        description: "Find Nearby Flash Deals",
        inputClass: NearbyDealsInput
    })

    async findNearbyDeals(input: NearbyDealsInput) {
        const response = await axios.get(
            `${process.env.BACKEND_URL}/deals/nearby`,
            {params: input}
        )
        return response.data;
    }

    @Tool({
        description: "Create a flash deal for a vendor",
        inputClass: CreateDealInput
    })

    async createDeal(input: CreateDealInput) {
        const response = await axios.post(
            `${process.env.BACKEND_URL}/deals`,
            input
        )
        return response.data
    }
}