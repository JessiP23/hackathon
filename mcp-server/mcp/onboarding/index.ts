import { Tool, SchemaConstraint } from '@leanmcp/core'
import axios from 'axios'

class CreateVendorInput {
    @SchemaConstraint({ description: "Vendor name" })
    name!: string;

    @SchemaConstraint({ description: "phone number" })
    phone!: string;

    @SchemaConstraint({ description: "Latitute" })
    lat!: number;

    @SchemaConstraint({ description: "Longitude" })
    lon!: number;
}

class UploadMenuInput{
    @SchemaConstraint({ description: "Vendor ID" })
    vendorId!: string;

    @SchemaConstraint({ description: "Menu image URL or base64" })
    menuImage!: string;
}

export class OnboardingService {
    @Tool({
        description: "Create a new street vendor",
        inputClass: CreateVendorInput
    })

    async createVendor(input: CreateVendorInput) {
        const response = await axios.post(
            `${process.env.BACKEND_URL}/vendors`,
            input
        )
        return response.data;
    }

    @Tool({
        description: "Upload and process a new menu",
        inputClass: UploadMenuInput
    })

    async uploadMenu(input: UploadMenuInput) {
        const response = await axios.post(
            `${process.env.BACKEND_URL}/vendors/menu`,
            input
        )
        return response.data
    }
}